// 에이전트용 컨텍스트: 내 다음 배정 토픽 + DB(Firestore)에 쌓인 노트 요약.
// 링크(선행/후속) 매핑의 근거 자료로 쓴다.  사용: npm run context -- <github-id>
import { loadTopics, loadTeam, loadSchedule, loadNotes, buildGraph } from './lib/notes.mjs';

const PROJECT = 'acestudy-cs';
const me = process.argv[2];
if (!me) throw new Error('사용법: npm run context -- <github-id>');

const [topicsFile, team, schedule] = await Promise.all([loadTopics(), loadTeam(), loadSchedule()]);
if (!team.members.includes(me)) throw new Error(`${me} 는 team.yaml 에 없음`);

const { notes, source } = await fetchDbNotes().catch(async (e) => {
  console.error(`Firestore 조회 실패(${e.message}) → 로컬 노트 사용`);
  return { notes: await loadNotes(), source: 'local' };
});
const graph = buildGraph(topicsFile, schedule, notes);

const mine = graph.topics.filter((t) => t.owner === me).sort((a, b) => a.session - b.session);
const next = mine.find((t) => !t.studied);

console.log(JSON.stringify({
  me,
  source,
  next: next ?? null,
  myProgress: `${mine.filter((t) => t.studied).length}/${mine.length}`,
  studiedNotes: notes.map((n) => ({
    topic: n.topic,
    title: n.title,
    author: n.author,
    prerequisites: n.prerequisites,
    leads_to: n.leads_to,
    summary: n.body.slice(0, 400),
  })),
  allTopics: graph.topics.map(({ id, title, hook, studied }) => ({ id, title, hook, studied })),
}, null, 2));

// 공개 읽기 규칙이라 인증 없이 REST 로 읽는다.
async function fetchDbNotes() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/notes?pageSize=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { documents = [] } = await res.json();
  return { notes: documents.map((d) => decode({ mapValue: { fields: d.fields } })), source: 'firestore' };
}

function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
  return null;
}
