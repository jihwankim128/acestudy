// 토픽·배정·노트 → site/data/*.json (페이지, 그래프, 에이전트가 함께 쓴다)
// --check: PR 검증 모드. 규칙 위반이 있으면 실패한다.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ROOT, loadTopics, loadTeam, loadSchedule, loadNotes, loadTossNotes, buildGraph, validate, collectSuggestions } from './lib/notes.mjs';

const [topicsFile, team, schedule, notes, toss] = await Promise.all([loadTopics(), loadTeam(), loadSchedule(), loadNotes(), loadTossNotes()]);
const graph = buildGraph(topicsFile, schedule, notes);
const errors = validate(graph, notes);

const out = join(ROOT, 'site/data');
await mkdir(join(out, 'viz'), { recursive: true });

// 시각화는 페이지에서 샌드박스 iframe 으로 띄운다
const VIZ_LIMIT = 300 * 1024;
for (const n of notes.filter((n) => n.viz)) {
  const { size } = await stat(join(ROOT, n.viz));
  if (size > VIZ_LIMIT) errors.push(`${n.viz}: ${Math.round(size / 1024)}KB — 300KB 이하로`);
  await copyFile(join(ROOT, n.viz), join(out, 'viz', `${n.topic}.html`));
  n.vizUrl = `/data/viz/${n.topic}.html`;
}

// Toss 학습 노트의 첨부 이미지는 원래 폴더 구조 그대로 /data/toss-notes/ 아래에 둔다
const IMAGE_LIMIT = 1024 * 1024;
const attachments = {};
for (const rel of toss.files) {
  const src = join(ROOT, 'toss-notes', rel);
  const { size } = await stat(src);
  if (size > IMAGE_LIMIT) errors.push(`toss-notes/${rel}: ${Math.round(size / 1024)}KB — 이미지는 1MB 이하로`);
  await mkdir(join(out, 'toss-notes', dirname(rel)), { recursive: true });
  await copyFile(src, join(out, 'toss-notes', rel));
  attachments[rel] = `/data/toss-notes/${rel.split('/').map(encodeURIComponent).join('/')}`;
}
const seen = new Map();
for (const n of toss.notes) {
  if (!n.member) { errors.push(`${n.path}: toss-notes/<github-id>/ 아래에 둬야 함`); continue; }
  const key = `${n.member}/${n.name}`;
  if (seen.has(key)) errors.push(`${n.path}: 노트 이름 '${n.name}' 이 ${seen.get(key)} 와 겹침`);
  seen.set(key, n.path);
}
// 탭 순서: team.yaml 팀원 먼저, 그 밖의 폴더는 뒤에
const tossMembers = [...new Set([...team.members, ...toss.folders])];

const write = (name, data) => writeFile(join(out, name), JSON.stringify(data, null, 2));
await write('notes.json', notes);
await write('graph.json', { categories: topicsFile.categories.map(({ id, name }) => ({ id, name })), ...graph });
await write('suggestions.json', collectSuggestions(topicsFile, notes));
await write('schedule.json', { members: team.members, sessions: schedule });
await write('toss-notes.json', { members: tossMembers, notes: toss.notes.filter((n) => n.member), attachments });

const studied = graph.topics.filter((t) => t.studied).length;
console.log(`notes ${notes.length} · studied ${studied}/${graph.topics.length} · edges ${graph.edges.length} · toss-notes ${toss.notes.length}`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  if (process.argv.includes('--check')) process.exit(1);
}
