import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function loadRoadmap() {
  return parse(await readFile(join(ROOT, 'curriculum/roadmap.yaml'), 'utf8'));
}

// notes/<author>/<topic>.md 를 모두 읽는다. _template 같은 _ 디렉터리는 제외.
export async function loadNotes() {
  const notesDir = join(ROOT, 'notes');
  const notes = [];
  for (const author of await readdir(notesDir, { withFileTypes: true })) {
    if (!author.isDirectory() || author.name.startsWith('_')) continue;
    for (const file of await readdir(join(notesDir, author.name))) {
      if (!file.endsWith('.md')) continue;
      const path = join(notesDir, author.name, file);
      const { meta, body } = splitFrontmatter(await readFile(path, 'utf8'));
      notes.push({
        id: `${author.name}/${file.replace(/\.md$/, '')}`,
        path: relative(ROOT, path),
        author: meta.author ?? author.name,
        topic: meta.topic ?? file.replace(/\.md$/, ''),
        title: meta.title ?? file,
        date: meta.date ? String(meta.date) : null,
        stage: meta.stage ?? 'basic',
        concepts: meta.concepts ?? [],
        sources: meta.sources ?? [],
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

// roadmap 대비 커버리지와 gap 계산
export function computeCoverage(roadmap, notes) {
  const topics = roadmap.tracks.flatMap((t) =>
    t.topics.map((topic) => ({ ...topic, track: t.id, trackName: t.name })),
  );
  const known = new Set(topics.map((t) => t.id));

  const coverage = topics.map((topic) => {
    const related = notes.filter((n) => n.topic === topic.id);
    const covered = new Set(related.flatMap((n) => n.concepts));
    return {
      id: topic.id,
      name: topic.name,
      track: topic.track,
      trackName: topic.trackName,
      authors: [...new Set(related.map((n) => n.author))],
      noteCount: related.length,
      coveredConcepts: topic.concepts.filter((c) => covered.has(c)),
      missingConcepts: topic.concepts.filter((c) => !covered.has(c)),
    };
  });

  const gaps = {
    uncovered: coverage.filter((c) => c.noteCount === 0).map((c) => c.id),
    partial: coverage
      .filter((c) => c.noteCount > 0 && c.missingConcepts.length > 0)
      .map(({ id, missingConcepts }) => ({ id, missingConcepts })),
    unknownTopics: [...new Set(notes.map((n) => n.topic).filter((t) => !known.has(t)))],
  };
  return { coverage, gaps };
}
