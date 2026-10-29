// Toss 스터디: CS 스터디와 같은 3단 구조(사이드바 문항 트리, 본문, 오른쪽 제출 이력)
// 제출 기록은 Firestore toss_submissions 에 { qid, name, content, createdAt } 으로 쌓인다.
import { GROUPS, ORDER, byId, titleOf, pad } from '/toss/groups.js';
import { loadNotes, aboutQuestion, noteHref } from '/toss/notes.js';

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2';
const COLLECTION = 'toss_submissions';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const meter = (pct, color) => `<span class="meter"><i style="width:${pct}%;background:${color}"></i></span>`;

// ---------- 로컬 보관: 이름, 작성 중인 답안 ----------
const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const who = $('#who');
who.value = local.get('toss-name') || '';
const me = () => who.value.trim();
who.addEventListener('input', () => { local.set('toss-name', me()); renderTree(); });

// ---------- 제출 기록 ----------
const subs = new Map(); // qid -> [{ name, content, at }] 최신순
let all = [];           // 전체 최신순
let subsState = 'loading';
let fb = null;

function pushSub(qid, entry) {
  const e = { qid, ...entry };
  if (!subs.has(qid)) subs.set(qid, []);
  subs.get(qid).push(e);
  all.push(e);
  const newest = (a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0);
  subs.get(qid).sort(newest);
  all.sort(newest);
}
const countOf = (qid) => subs.get(qid)?.length ?? 0;
const mineHas = (qid) => !!me() && (subs.get(qid) ?? []).some((s) => s.name === me());

async function connect() {
  const [{ initializeApp }, fs, { firebaseConfig }] = await Promise.all([
    import(`${FIREBASE}/firebase-app.js`),
    import(`${FIREBASE}/firebase-firestore.js`),
    import('/toss/firebase-config.js'),
  ]);
  const db = fs.getFirestore(initializeApp(firebaseConfig));
  fb = { db, ...fs };
  const snap = await fs.getDocs(fs.query(fs.collection(db, COLLECTION), fs.limit(5000)));
  snap.forEach((doc) => {
    const d = doc.data();
    if (byId.has(d.qid)) pushSub(d.qid, { name: d.name, content: d.content, at: d.createdAt?.toDate?.() ?? null });
  });
}

async function submit(qid, ta, btn, status) {
  const say = (kind, text) => { status.className = `status ${kind}`; status.textContent = text; };
  const name = me();
  const content = ta.value.trim();
  if (!name) { say('error', '오른쪽 위 이름 칸을 먼저 채워 주세요.'); who.focus(); return; }
  if (!content) { say('error', '답안을 적은 뒤 제출하세요.'); ta.focus(); return; }
  if (!fb) { say('error', '저장소에 연결하지 못했어요. 새로고침 후 다시 시도하세요.'); return; }
  btn.disabled = true;
  say('', '제출하는 중');
  try {
    await fb.addDoc(fb.collection(fb.db, COLLECTION), { qid, name, content, createdAt: fb.serverTimestamp() });
    pushSub(qid, { name, content, at: new Date() });
    say('ok', '제출했어요.');
    renderTree();
    refreshSide();
  } catch (e) {
    say('error', e?.code === 'permission-denied'
      ? '제출하지 못했어요. 이름은 30자, 답안은 2만 자까지입니다.'
      : '제출하지 못했어요. 잠시 후 다시 시도하세요.');
  } finally {
    btn.disabled = false;
  }
}

const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const when = (at) => (at ? `<time datetime="${at.toISOString()}">${esc(fmt.format(at))}</time>` : '<time>방금</time>');

// ---------- 사이드바 문항 트리 ----------
let current = null;
function renderTree() {
  const mine = ORDER.filter((e) => mineHas(e.item.id)).length;
  $('#progress').textContent = me() ? `${mine}/${ORDER.length}` : `${ORDER.length}문항`;
  $('#tree').innerHTML = GROUPS.map((g) => {
    const done = g.items.filter((it) => mineHas(it.id)).length;
    const pct = Math.round((done / g.items.length) * 100);
    return `<details open><summary><span class="dot" style="--c:${css(g.color)}"></span>${esc(g.name)}
        <span class="count">${me() ? `${done}/` : ''}${g.items.length}</span></summary>
      <div class="cat-meter">${meter(pct, css(g.color))}</div>
      ${g.items.map((it, i) => {
        const e = byId.get(it.id);
        const n = subsState === 'ready' ? countOf(it.id) : 0;
        return `<a class="file ${mineHas(it.id) ? 'done mine' : ''} ${current === it.id ? 'active' : ''}" href="#/q/${it.id}" title="${esc(titleOf(e))}">
          <span class="check">${mineHas(it.id) ? '✓' : '○'}</span><span class="num">${pad(i + 1)}</span>
          <span class="label">${esc(titleOf(e))}</span>${n ? `<span class="owner">${n}</span>` : ''}</a>`;
      }).join('')}
    </details>`;
  }).join('');
}

// ---------- 문항 본문 ----------
function answerBox(e, scope) {
  const { item, group } = e;
  const wrap = document.createElement('div');
  const id = `${scope}-${item.id}`;
  const coding = group.kind === 'coding';
  wrap.innerHTML = `<label class="label-sm" for="${id}">${coding ? 'solution 함수 구현 (Java)' : '내 답안'}</label>
    <textarea id="${id}" class="${coding ? 'mono' : group.kind === 'quiz' ? 'short' : ''}" maxlength="20000"
      data-draft="${item.id}" ${coding ? 'spellcheck="false"' : ''}></textarea>
    <div class="actions"><button class="btn" type="button">제출</button>
      ${coding ? '<button class="btn ghost reset" type="button">처음 코드로 되돌리기</button>' : ''}
      <span class="status" aria-live="polite"></span></div>
    <details class="quiz"><summary>${group.kind === 'coding' ? '접근법과 모범 풀이' : '모범답안'}</summary><div class="ans"></div></details>`;
  const ta = wrap.querySelector('textarea');
  // 코딩은 프로그래머스처럼 solution 메서드 틀이 채워진 상태에서 시작한다
  ta.value = local.get(`toss-draft:${item.id}`) || (coding ? item.template : '');
  const save = () => {
    local.set(`toss-draft:${item.id}`, ta.value);
    document.querySelectorAll(`[data-draft="${item.id}"]`).forEach((t) => { if (t !== ta) t.value = ta.value; });
  };
  ta.addEventListener('input', save);
  if (coding) {
    // Tab 은 들여쓰기 4칸. 다음 칸으로 이동하려면 Esc 후 Tab
    let escaped = false;
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { escaped = true; return; }
      if (ev.key !== 'Tab' || ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey || escaped) { escaped = false; return; }
      ev.preventDefault();
      ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end');
      save();
    });
    const reset = wrap.querySelector('.reset');
    reset.addEventListener('click', () => {
      if (ta.value !== item.template && reset.dataset.armed !== '1') {
        reset.dataset.armed = '1';
        reset.textContent = '지금 코드를 지울까요? 한 번 더 누르세요';
        setTimeout(() => { reset.dataset.armed = ''; reset.textContent = '처음 코드로 되돌리기'; }, 3000);
        return;
      }
      reset.dataset.armed = '';
      reset.textContent = '처음 코드로 되돌리기';
      ta.value = item.template;
      save();
    });
  }
  const btn = wrap.querySelector('.btn');
  btn.addEventListener('click', () => submit(item.id, ta, btn, wrap.querySelector('.status')));
  // 펼칠 때 채워서, 답을 쓰기 전에 실수로 내용이 보이는 일을 줄인다
  const model = wrap.querySelector('details');
  model.addEventListener('toggle', () => {
    const ans = model.querySelector('.ans');
    if (!model.open || ans.childElementCount) return;
    ans.innerHTML = group.kind === 'coding' ? item.approach
      : item.brief ? `<div class="brief"><span class="label-sm">5분 답안</span><p>${item.brief}</p></div>
        <span class="label-sm">자세한 해설</span>${item.a}`
      : item.a;
    if (group.kind === 'coding') ans.insertAdjacentHTML('beforeend', `<pre><code>${esc(item.code)}</code></pre>`);
    if (group.kind === 'quiz' && item.ref) {
      const ref = ORDER.find((x) => `${x.group.label} ${x.no}` === item.ref);
      ans.insertAdjacentHTML('beforeend', `<p class="src">더 깊게: ${ref ? `<a class="wikilink" href="#/q/${ref.item.id}">${esc(item.ref)}</a>` : esc(item.ref)}</p>`);
    }
  });
  return wrap;
}

// 코딩은 프로그래머스 문제 화면과 같은 순서: 문제 설명, 제한사항, 입출력 예 표, 입출력 예 설명
function codingHtml(item) {
  const cols = item.examples[0].args.map(([name]) => name);
  const rows = item.examples.map((ex) => `<tr>${ex.args.map(([, v]) => `<td><code>${esc(v)}</code></td>`).join('')}
    <td><code>${esc(ex.result)}</code></td></tr>`).join('');
  return `<h3 class="sec">문제 설명</h3><div class="q-body">${item.body}</div>
    <h3 class="sec">제한사항</h3><ul class="limits">${item.limits}</ul>
    <h3 class="sec">입출력 예</h3>
    <div class="io-tbl"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}<th>result</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3 class="sec">입출력 예 설명</h3><div class="q-body">${item.explain}</div>`;
}

function questionHead(e) {
  const { item, group } = e;
  const chips = group.kind === 'quiz' ? [item.type] : item.chips;
  const isCase = group.kind === 'coding' || item.case;
  return `<div class="props">${chips.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}
      ${isCase ? `<span class="tag case">${group.kind === 'coding' ? esc(item.case) : '토스증권 사례'}</span>` : ''}</div>
    ${group.kind === 'coding' ? codingHtml(item) : `<div class="q-body"><p>${item.q}</p></div>`}`;
}

function renderQuestion(id) {
  const e = byId.get(id);
  const view = $('#question-view');
  if (!e) { view.innerHTML = '<h1>없는 문항</h1><p class="muted">왼쪽 목록에서 문항을 고르세요.</p>'; return; }
  const { item, group, no } = e;
  const i = ORDER.indexOf(e);
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];
  view.innerHTML = `<div class="crumb">toss / ${esc(group.name)} / ${pad(no)}</div>
    <h1>${group.kind === 'coding' ? esc(item.title) : `${esc(group.label)} ${pad(no)}`}</h1>
    ${questionHead(e)}`;
  view.append(answerBox(e, 'q'));
  view.insertAdjacentHTML('beforeend', `<nav class="pager">
      ${prev ? `<a href="#/q/${prev.item.id}">← ${esc(prev.group.label)} ${pad(prev.no)}</a>` : '<span></span>'}
      ${next ? `<a href="#/q/${next.item.id}">${esc(next.group.label)} ${pad(next.no)} →</a>` : '<span></span>'}
    </nav>`);
  view.scrollTop = 0;
}

// ---------- 오른쪽 패널 ----------
function historyHtml(qid) {
  if (subsState === 'loading') return '<div class="skel" aria-label="불러오는 중"><i></i><i></i><i></i></div>';
  if (subsState === 'error') return '<p class="empty">제출 이력을 불러오지 못했어요. 새로고침하세요.</p>';
  const list = subs.get(qid) ?? [];
  if (!list.length) return '<p class="empty">아직 제출한 사람이 없어요. 첫 답안을 남겨 보세요.</p>';
  const mono = qid.startsWith('c');
  return list.map((s) => `<article class="entry"><header><b>${esc(s.name)}</b>${when(s.at)}</header>
    <div class="body ${mono ? 'mono' : ''}">${esc(s.content)}</div></article>`).join('');
}

function membersHtml() {
  if (subsState !== 'ready') return historyHtml('');
  const names = [...new Set(all.map((s) => s.name))];
  if (!names.length) return '<p class="empty">아직 제출 기록이 없어요.</p>';
  return names.map((n) => {
    const qs = new Set(all.filter((s) => s.name === n).map((s) => s.qid)).size;
    return `<div class="side-member"><span>${esc(n)}</span><span class="muted small">${qs}/${ORDER.length}</span>${meter((qs / ORDER.length) * 100, css('--accent'))}</div>`;
  }).join('');
}

// 이 문항을 [[c1]] 처럼 링크한 Toss 노트 (Toss 노트 페이지로 이동)
const noteLinks = (list) => list.map((n) => `<a class="file" href="${noteHref(n)}"><span class="check">◇</span>
  <span class="label">${esc(n.title)}</span><span class="owner">${esc(n.member)}</span></a>`).join('');

let route = 'overview';
function refreshSide() {
  const side = $('#side');
  if (route === 'question') {
    const about = aboutQuestion(current);
    side.innerHTML = `${about.length ? `<h4>이 문항을 다룬 노트<span class="n">${about.length}</span></h4>${noteLinks(about)}` : ''}
      <h4>제출 이력<span class="n">${subsState === 'ready' ? countOf(current) : ''}</span></h4>${historyHtml(current)}`;
  } else if (route === 'mock') {
    if (side.firstChild !== mockSide) side.replaceChildren(mockSide);
    mockSide.querySelector('#mock-list').innerHTML = paper.map((e) =>
      `<a class="file ${mineHas(e.item.id) ? 'done' : ''}" href="#/q/${e.item.id}"><span class="check">${mineHas(e.item.id) ? '✓' : '○'}</span>
        <span class="label">${esc(e.group.label)} ${pad(e.no)}</span></a>`).join('');
  } else {
    side.innerHTML = `<h4>팀원별 제출 문항</h4>${membersHtml()}`;
  }
  if (route === 'records') renderRecords();
}

function renderRecords() {
  const view = $('#records-view');
  let body;
  if (subsState === 'loading') body = '<div class="skel"><i></i><i></i><i></i></div>';
  else if (subsState === 'error') body = '<p class="muted">제출 기록을 불러오지 못했어요. 새로고침하세요.</p>';
  else if (!all.length) body = '<p class="muted">아직 제출 기록이 없어요. 문항을 골라 첫 답안을 남겨 보세요.</p>';
  else body = all.slice(0, 100).map((s) => {
    const e = byId.get(s.qid);
    return `<article class="rec"><header><b>${esc(s.name)}</b>
        <a href="#/q/${s.qid}">${esc(e.group.name)} ${pad(e.no)}</a>${when(s.at)}</header>
      <div class="body ${e.group.kind === 'coding' ? 'mono' : ''}">${esc(s.content)}</div></article>`;
  }).join('');
  view.innerHTML = `<div class="crumb">toss / 기록</div><h1>최근 제출</h1>
    <div class="props"><span>전체 <b>${all.length}</b>건</span><span>최근 100건까지 표시</span></div>${body}`;
}

// ---------- 모의고사 ----------
const pick = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
let paper = [];
function drawPaper() {
  const from = (gid, n) => pick(GROUPS.find((g) => g.id === gid).items, n).map((it) => byId.get(it.id));
  const parts = [
    ['코딩', '1문항', from('coding', 1)],
    ['주관식', '5문항 · 25분 (서술 4, 키워드 1)', [...from('short', 4), ...from('keyword', 1)]],
    ['서술형', '2문항 · 30분', from('essay', 2)],
  ];
  paper = parts.flatMap((p) => p[2]);
  const box = $('#mock-paper');
  box.replaceChildren();
  for (const [name, meta, list] of parts) {
    box.insertAdjacentHTML('beforeend', `<div class="mock-part"><h2>${name}</h2><span class="muted small">${meta}</span></div>`);
    for (const e of list) {
      const q = document.createElement('section');
      q.className = 'mock-q';
      q.innerHTML = `<div class="crumb"><a href="#/q/${e.item.id}">${esc(e.group.name)} ${pad(e.no)}</a></div>
        ${e.group.kind === 'coding' ? `<h3>${esc(e.item.title)}</h3>` : ''}${questionHead(e)}`;
      q.append(answerBox(e, 'mock'));
      box.append(q);
    }
  }
  resetTimer();
  if (route === 'mock') refreshSide();
}

const mockSide = document.createElement('div');
// 구간 타이머: 안내받은 시간(주관식 25분, 서술형 30분)과 시간이 정해지지 않은 코딩
mockSide.innerHTML = `<h4>타이머</h4>
  <div class="phases" role="group" aria-label="시험 구간">
    <button type="button" data-min="25" aria-pressed="true">주관식 25분</button>
    <button type="button" data-min="30" aria-pressed="false">서술형 30분</button>
    <button type="button" data-min="60" aria-pressed="false">코딩 60분</button>
  </div>
  <div class="timer" id="timer" aria-live="polite">25:00</div>
  <div class="side-ctrl">
    <button class="btn ghost" id="btn-timer" type="button">시작</button>
    <button class="btn ghost" id="btn-reset" type="button">초기화</button>
    <button class="btn" id="btn-draw" type="button">새 시험지</button>
  </div>
  <p class="muted small side-note">코딩 시간은 안내가 없어 60분으로 두었어요.</p>
  <h4>이번 시험지</h4><div id="mock-list"></div>`;
const timer = mockSide.querySelector('#timer');
const timerBtn = mockSide.querySelector('#btn-timer');
let phaseMin = 25;
mockSide.querySelectorAll('.phases button').forEach((b) => b.addEventListener('click', () => {
  mockSide.querySelectorAll('.phases button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  phaseMin = Number(b.dataset.min);
  resetTimer();
}));
let remain = phaseMin * 60;
let ticking = null;
function showTime() {
  if (remain <= 0) { timer.textContent = '시간 종료'; timer.classList.add('over'); return; }
  timer.classList.remove('over');
  timer.textContent = `${pad(Math.floor(remain / 60))}:${pad(remain % 60)}`;
}
function resetTimer() {
  clearInterval(ticking);
  ticking = null;
  remain = phaseMin * 60;
  timerBtn.textContent = '시작';
  showTime();
}
timerBtn.addEventListener('click', () => {
  if (ticking) { clearInterval(ticking); ticking = null; timerBtn.textContent = '계속'; return; }
  if (remain <= 0) resetTimer();
  timerBtn.textContent = '일시정지';
  ticking = setInterval(() => {
    remain -= 1;
    showTime();
    if (remain <= 0) { clearInterval(ticking); ticking = null; timerBtn.textContent = '시작'; }
  }, 1000);
});
mockSide.querySelector('#btn-reset').addEventListener('click', resetTimer);
mockSide.querySelector('#btn-draw').addEventListener('click', drawPaper);

// ---------- 라우팅 (#/overview, #/mock, #/records, #/q/<id>) ----------
function go() {
  const [, view = 'overview', id] = location.hash.split('/');
  route = view === 'q' && id ? 'question' : ['mock', 'records'].includes(view) ? view : 'overview';
  current = route === 'question' ? id : null;
  document.body.dataset.view = route;
  document.querySelectorAll('.views a').forEach((a) => a.classList.toggle('active', a.dataset.view === route));
  if (route === 'question') renderQuestion(id);
  renderTree();
  refreshSide();
  // 현재 문항이 사이드바 밖에 있으면 사이드바만 스크롤한다 (scrollIntoView 는 모바일에서 페이지까지 움직인다)
  const active = document.querySelector('.file.active');
  const bar = $('.sidebar');
  if (active) {
    const top = active.getBoundingClientRect().top - bar.getBoundingClientRect().top + bar.scrollTop;
    if (top < bar.scrollTop || top > bar.scrollTop + bar.clientHeight - 40) bar.scrollTop = top - bar.clientHeight / 2;
  }
}
window.addEventListener('hashchange', go);

$('#bank-total').textContent = ORDER.length;
drawPaper();
go();

loadNotes().then(() => { if (route === 'question') refreshSide(); });

connect()
  .then(() => { subsState = 'ready'; })
  .catch((e) => { subsState = 'error'; console.error('Firestore 연결 실패', e); })
  .finally(() => { renderTree(); refreshSide(); });
