// 에이전트용 컨텍스트: 다음에 학습할 토픽 + DB(Firestore)에 쌓인 노트 요약.
// 토픽은 미리 배정하지 않는다. 누군가 학습해서 노트를 올리면 그때 그 사람이 토픽에 연결된다.
// 다음 토픽은 "아무도 학습하지 않았고, 다른 팀원이 진행 중(열린 study/<topic-id> PR)이 아닌" 토픽 중에서 고른다.
// 사용: npm run context -- <github-id> [topic-id]
import { execFileSync } from 'node:child_process';
import { loadTopics, loadTeam, loadNotes, buildGraph, collectSuggestions } from './lib/notes.mjs';

const PROJECT = 'acestudy-cs';
const REPO = 'jihwankim128/acestudy';
const [me, wanted] = process.argv.slice(2);
if (!me) throw new Error('사용법: npm run context -- <github-id> [topic-id]');

const [topicsFile, team] = await Promise.all([loadTopics(), loadTeam()]);
if (!team.members.includes(me)) throw new Error(`${me} 는 curriculum/team.yaml 에 없음`);

const { notes, source } = await fetchDbNotes().catch(async (e) => {
  console.error(`Firestore 조회 실패(${e.message}) → 로컬 노트 사용`);
  return { notes: await loadNotes(), source: 'local' };
});
const graph = buildGraph(topicsFile, notes);
const byId = new Map(graph.topics.map((t) => [t.id, t]));

// 진행 중인 토픽 = 열린 study/<topic-id> PR. 먼저 PR을 연 사람이 그 토픽을 가져간다.
const claims = openStudyClaims();
const myInProgress = [...claims].filter(([, who]) => who === me).map(([id]) => byId.get(id)).filter(Boolean);
const available = graph.topics.filter((t) => !t.studied && !claims.has(t.id));

// 시스템 설계·실전·심화 목차를 추가해도 기본 CS 준비도의 분모는 해당 5개 영역으로 유지한다.
const basicCategories = new Set(['arch', 'os', 'net', 'ds', 'db']);
const basic = graph.topics.filter((t) => basicCategories.has(t.category));
const basicRatio = basic.filter((t) => t.studied).length / basic.length;

// 다음 토픽: 지정한 토픽 → 내가 진행 중인 토픽 → 랜덤(카테고리를 하나 고르고 그 안에서 하나).
// 기본 CS 가 70% 미만이면 기본 CS 카테고리에서 먼저 고른다.
let next = null;
let reason = null;
if (wanted) {
  const t = byId.get(wanted);
  if (!t) reason = `'${wanted}' 는 topics.yaml 에 없는 토픽`;
  else if (t.studied) reason = `'${wanted}' 는 ${t.owner} 가 이미 학습함`;
  else if (claims.has(wanted) && claims.get(wanted) !== me) reason = `'${wanted}' 는 ${claims.get(wanted)} 가 진행 중`;
  else next = t;
} else if (myInProgress.length) {
  next = myInProgress[0];
  reason = '진행 중인 내 토픽을 이어서 한다';
} else {
  const pool = basicRatio < 0.7 && available.some((t) => basicCategories.has(t.category))
    ? available.filter((t) => basicCategories.has(t.category))
    : available;
  const categories = [...new Set(pool.map((t) => t.category))];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const inCategory = pool.filter((t) => t.category === category);
  next = inCategory[Math.floor(Math.random() * inCategory.length)] ?? null;
  reason = next ? `${next.categoryName} 카테고리에서 랜덤으로 골랐다` : '학습할 수 있는 토픽이 없다 → expand';
}

const suggestions = collectSuggestions(topicsFile, notes);
// 토픽 확장 권장: 남은 토픽이 팀원 수의 2배 이하이거나, 제안이 6개 이상 쌓였을 때
const expand = {
  recommended: available.length <= team.members.length * 2 || suggestions.length >= 6,
  available: available.length,
  suggestionCount: suggestions.length,
  practiceReady: basicRatio >= 0.7, // 기본 CS 70% 이상 → 실전 학습 권장
  basicProgress: `${basic.filter((t) => t.studied).length}/${basic.length}`,
};

console.log(JSON.stringify({
  me,
  source,
  next,
  reason,
  myStudied: graph.topics.filter((t) => t.owner === me).length,
  inProgress: [...claims].map(([topic, who]) => ({ topic, who })),
  expand,
  categoryProgress: topicsFile.categories.map((c) => {
    const items = graph.topics.filter((t) => t.category === c.id);
    const done = items.filter((t) => t.studied).length;
    return { id: c.id, name: c.name, done, available: items.filter((t) => available.includes(t)).length, total: items.length, complete: items.length > 0 && done === items.length };
  }),
  suggestions,
  studiedNotes: notes.map((n) => ({
    topic: n.topic,
    title: n.title,
    author: n.author,
    prerequisites: n.prerequisites,
    leads_to: n.leads_to,
    summary: n.body.slice(0, 400),
  })),
  allTopics: graph.topics.map(({ id, title, hook, studied, owner }) => ({ id, title, hook, studied, owner })),
}, null, 2));

// 열린 study/<topic-id> PR → Map(topicId → PR 작성자). gh 가 없거나 실패하면 빈 Map.
function openStudyClaims() {
  try {
    const out = execFileSync('gh', ['pr', 'list', '-R', REPO, '--state', 'open', '--limit', '200', '--json', 'headRefName,author'], { encoding: 'utf8' });
    return new Map(JSON.parse(out)
      .filter((pr) => pr.headRefName.startsWith('study/'))
      .map((pr) => [pr.headRefName.slice('study/'.length), pr.author.login]));
  } catch (e) {
    console.error(`진행 중 PR 조회 실패(${e.message.split('\n')[0]}) → 진행 중 토픽을 알 수 없음`);
    return new Map();
  }
}

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
