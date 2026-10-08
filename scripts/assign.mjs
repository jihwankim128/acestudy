// 토픽을 세션 단위로 팀원에게 랜덤 배정해 curriculum/schedule.yaml 에 기록한다.
// - 세션 하나 = 카테고리 하나, 팀원마다 그 카테고리의 서로 다른 토픽 1개 (겹침 없음)
// - 이미 배정된 세션은 유지하고, 새로 추가된 토픽만 뒤에 이어 붙인다.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { ROOT, loadTopics, loadTeam, loadSchedule } from './lib/notes.mjs';

const { categories } = await loadTopics();
const team = await loadTeam();
const schedule = await loadSchedule();
const rand = seededRandom(`${team.seed}:${schedule.length}`);

const assigned = new Set(schedule.flatMap((s) => Object.values(s.assignments)));
const pools = new Map(
  categories.map((c) => [c.id, shuffle(c.topics.map((t) => t.id).filter((id) => !assigned.has(id)), rand)]),
);

const n = team.members.length;
while (true) {
  const ready = [...pools].filter(([, pool]) => pool.length >= n).map(([id]) => id);
  if (!ready.length) break;
  const category = ready[Math.floor(rand() * ready.length)];
  const members = shuffle(team.members, rand);
  schedule.push({
    session: schedule.length + 1,
    category,
    assignments: Object.fromEntries(members.map((m) => [m, pools.get(category).pop()])),
  });
}
// 카테고리에 n개 미만으로 남은 토픽은 섞어서 혼합 세션으로
const leftovers = shuffle([...pools.values()].flat(), rand);
while (leftovers.length) {
  const members = shuffle(team.members, rand).slice(0, leftovers.length);
  schedule.push({
    session: schedule.length + 1,
    category: 'mixed',
    assignments: Object.fromEntries(members.map((m) => [m, leftovers.pop()])),
  });
}

await writeFile(
  join(ROOT, 'curriculum/schedule.yaml'),
  `# scripts/assign.mjs 가 생성. 직접 수정하지 말고 토픽 추가 후 npm run assign\n${stringify({ sessions: schedule })}`,
);
console.log(`sessions: ${schedule.length}`);

function seededRandom(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
