// 토픽·배정·노트 → site/data/*.json (페이지, 그래프, 에이전트가 함께 쓴다)
// --check: PR 검증 모드. 규칙 위반이 있으면 실패한다.
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadTopics, loadTeam, loadSchedule, loadNotes, buildGraph, validate, collectSuggestions } from './lib/notes.mjs';

const [topicsFile, team, schedule, notes] = await Promise.all([loadTopics(), loadTeam(), loadSchedule(), loadNotes()]);
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

const write = (name, data) => writeFile(join(out, name), JSON.stringify(data, null, 2));
await write('notes.json', notes);
await write('graph.json', { categories: topicsFile.categories.map(({ id, name }) => ({ id, name })), ...graph });
await write('suggestions.json', collectSuggestions(topicsFile, notes));
await write('schedule.json', { members: team.members, sessions: schedule });

const studied = graph.topics.filter((t) => t.studied).length;
console.log(`notes ${notes.length} · studied ${studied}/${graph.topics.length} · edges ${graph.edges.length}`);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  if (process.argv.includes('--check')) process.exit(1);
}
