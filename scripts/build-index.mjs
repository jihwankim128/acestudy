// 노트와 roadmap을 읽어 site/data/*.json 을 만든다. 페이지와 에이전트(gap 판단)가 함께 쓴다.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadRoadmap, loadNotes, computeCoverage } from './lib/notes.mjs';

const roadmap = await loadRoadmap();
const notes = await loadNotes();
const { coverage, gaps } = computeCoverage(roadmap, notes);

const out = join(ROOT, 'site/data');
await mkdir(out, { recursive: true });
const write = (name, data) => writeFile(join(out, name), JSON.stringify(data, null, 2));

await write('notes.json', notes);
await write('coverage.json', { stages: roadmap.stages, coverage });
await write('gaps.json', gaps);

const total = coverage.length;
const done = coverage.filter((c) => c.noteCount > 0).length;
console.log(`notes: ${notes.length}, topics covered: ${done}/${total}`);
if (gaps.unknownTopics.length) {
  console.warn(`roadmap에 없는 topic: ${gaps.unknownTopics.join(', ')}`);
}
