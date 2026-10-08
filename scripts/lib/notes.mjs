import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LINK_KEYS = ['prerequisites', 'leads_to', 'related'];

const readYaml = async (path) => parse(await readFile(join(ROOT, path), 'utf8'));

export const loadTopics = () => readYaml('curriculum/topics.yaml');
export const loadTeam = () => readYaml('curriculum/team.yaml');
export async function loadSchedule() {
  if (!existsSync(join(ROOT, 'curriculum/schedule.yaml'))) return [];
  return (await readYaml('curriculum/schedule.yaml')).sessions ?? [];
}

// notes/<category>/<topic-id>.md — notes/ 는 그대로 옵시디언 vault 로 열 수 있다.
export async function loadNotes() {
  const notesDir = join(ROOT, 'notes');
  const notes = [];
  for (const dir of await readdir(notesDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name.startsWith('.')) continue;
    for (const file of await readdir(join(notesDir, dir.name))) {
      if (!file.endsWith('.md')) continue;
      const vizPath = join(notesDir, dir.name, file).replace(/\.md$/, '.viz.html');
      const path = join(notesDir, dir.name, file);
      const { meta, body } = splitFrontmatter(await readFile(path, 'utf8'));
      const wikiLinks = [...body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map((m) => m[1].trim());
      const prerequisites = meta.prerequisites ?? [];
      const leadsTo = meta.leads_to ?? [];
      const directed = new Set([...prerequisites, ...leadsTo]);
      notes.push({
        topic: meta.topic ?? file.replace(/\.md$/, ''),
        path: relative(ROOT, path),
        title: meta.title ?? file,
        author: meta.author ?? null,
        date: meta.date ? String(meta.date) : null,
        prerequisites,
        leads_to: leadsTo,
        related: [...new Set([...(meta.related ?? []), ...wikiLinks])].filter((id) => !directed.has(id)),
        sources: meta.sources ?? [],
        suggest: meta.suggest ?? [],
        quiz: meta.quiz ?? [],
        viz: existsSync(vizPath) ? relative(ROOT, vizPath) : null,
        body,
      });
    }
  }
  return notes;
}

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  return { meta: parse(m[1]) ?? {}, body: m[2].trim() };
}

// 토픽 풀 + 배정 + 노트를 합쳐 지식 그래프를 만든다.
// 엣지 방향: source(선행) → target(후속). leads_to 는 뒤집어서 같은 방향으로 맞춘다.
export function buildGraph({ categories }, schedule, notes) {
  const owner = new Map();
  for (const s of schedule) {
    for (const [member, topic] of Object.entries(s.assignments)) owner.set(topic, { member, session: s.session });
  }
  const noteByTopic = new Map(notes.map((n) => [n.topic, n]));

  const topics = categories.flatMap((c) =>
    c.topics.map((t) => ({
      ...t,
      category: c.id,
      categoryName: c.name,
      owner: owner.get(t.id)?.member ?? null,
      session: owner.get(t.id)?.session ?? null,
      studied: noteByTopic.has(t.id),
    })),
  );
  const known = new Set(topics.map((t) => t.id));

  const edges = [];
  const seen = new Set();
  const add = (source, target, type) => {
    const key = `${source}>${target}>${type}`;
    if (source === target || seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, type });
  };
  for (const n of notes) {
    n.prerequisites.forEach((p) => add(p, n.topic, 'prerequisite'));
    n.leads_to.forEach((t) => add(n.topic, t, 'prerequisite'));
    n.related.forEach((r) => add(n.topic, r, 'related'));
  }

  const unknown = [...new Set(edges.flatMap((e) => [e.source, e.target]).filter((id) => !known.has(id)))];
  return { topics, edges, unknown };
}

// PR 검증: 배정된 사람만, 존재하는 토픽으로만 링크
export function validate(graph, notes) {
  const errors = [];
  const byId = new Map(graph.topics.map((t) => [t.id, t]));
  const knownCategories = new Set(graph.topics.map((t) => t.category));
  for (const n of notes) {
    const t = byId.get(n.topic);
    if (!t) { errors.push(`${n.path}: topics.yaml 에 없는 topic '${n.topic}'`); continue; }
    if (!n.path.startsWith(`notes/${t.category}/`)) errors.push(`${n.path}: notes/${t.category}/ 아래에 있어야 함`);
    if (t.owner && n.author !== t.owner) errors.push(`${n.path}: 담당자는 ${t.owner} (author: ${n.author})`);
    if (!n.viz) errors.push(`${n.path}: 시각화 파일 ${n.path.replace(/\.md$/, '.viz.html')} 필요`);
    if (!n.prerequisites.length && !n.leads_to.length) errors.push(`${n.path}: prerequisites 또는 leads_to 링크가 최소 1개 필요`);
    if (!n.suggest.length) errors.push(`${n.path}: suggest(새 토픽 제안) 최소 1개 필요`);
    for (const sg of n.suggest) {
      if (!sg?.title || !sg?.category || !sg?.why) errors.push(`${n.path}: suggest 항목은 title, category, why 가 필요`);
      else if (!knownCategories.has(sg.category) && !sg.category_name) errors.push(`${n.path}: 새 카테고리 '${sg.category}' 제안에는 category_name 필요`);
    }
    if (n.quiz.length < 2) errors.push(`${n.path}: quiz 최소 2개 필요`);
    for (const q of n.quiz) if (!q?.q || !q?.a) errors.push(`${n.path}: quiz 항목은 q, a 가 필요`);
    for (const key of LINK_KEYS) {
      for (const id of n[key]) if (!byId.has(id)) errors.push(`${n.path}: ${key} 의 '${id}' 는 없는 토픽`);
    }
  }
  return errors;
}

// 노트들의 suggest 를 모아 아직 토픽 풀에 없는 후보만 남긴다 (확장 스킬의 입력)
export function collectSuggestions({ categories }, notes) {
  const norm = (s) => String(s).toLowerCase().replace(/[\s·/()-]/g, '');
  const existing = new Set(categories.flatMap((c) => c.topics.map((t) => norm(t.title))));
  const byTitle = new Map();
  for (const n of notes) {
    for (const sg of n.suggest ?? []) {
      const key = norm(sg.title);
      if (!sg.title || existing.has(key)) continue;
      const entry = byTitle.get(key) ?? { title: sg.title, category: sg.category, categoryName: sg.category_name ?? null, reasons: [], from: [] };
      entry.reasons.push(sg.why);
      entry.from.push(n.topic);
      byTitle.set(key, entry);
    }
  }
  return [...byTitle.values()].sort((a, b) => b.from.length - a.from.length);
}
