// Toss 스터디: 문제은행 렌더링 + 문항별 답안 제출과 제출 이력 (Firestore toss_submissions)
import { CODING, QUIZ, DESIGN, CONCEPT } from '/toss/questions.js';

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2';
const COLLECTION = 'toss_submissions';
const $ = (sel) => document.querySelector(sel);

// ---------- 로컬 보관: 이름, 작성 중인 답안, 마지막 탭 ----------
const local = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};
const who = $('#who');
who.value = local.get('toss-name') || '';
who.addEventListener('input', () => local.set('toss-name', who.value.trim()));

// ---------- 제출 기록: 페이지를 열 때 한 번 전부 읽고 문항별로 묶는다 ----------
const subs = new Map();          // qid -> [{ name, content, at }]
let subsState = 'loading';       // loading | ready | error
let fb = null;

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
    pushSub(d.qid, { name: d.name, content: d.content, at: d.createdAt?.toDate?.() ?? null });
  });
}

function pushSub(qid, entry) {
  if (!subs.has(qid)) subs.set(qid, []);
  subs.get(qid).push(entry);
  subs.get(qid).sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
}

// 같은 문항이 문제은행과 모의고사에 동시에 그려질 수 있어서, qid 로 묶인 모든 사본을 갱신한다
function refresh(qid) {
  document.querySelectorAll(`[data-count="${qid}"]`).forEach((el) => {
    el.textContent = subsState === 'ready' ? String(subs.get(qid)?.length ?? 0) : '';
  });
  document.querySelectorAll(`[data-hist="${qid}"]`).forEach((el) => { if (!el.hidden) drawHistory(el, qid); });
}

const fmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

function drawHistory(box, qid) {
  box.replaceChildren();
  if (subsState === 'loading') {
    box.innerHTML = '<div class="skel" aria-label="제출 이력을 불러오는 중"><i></i><i></i><i></i></div>';
    return;
  }
  if (subsState === 'error') {
    box.innerHTML = '<p class="empty">제출 이력을 불러오지 못했어요. 네트워크를 확인하고 새로고침하세요.</p>';
    return;
  }
  const list = subs.get(qid) ?? [];
  if (!list.length) {
    box.innerHTML = '<p class="empty">아직 제출한 사람이 없어요. 첫 답안을 남겨 보세요.</p>';
    return;
  }
  const mono = qid.startsWith('c');
  for (const s of list) {
    const row = document.createElement('article');
    row.className = 'entry';
    const head = document.createElement('header');
    const name = document.createElement('b');
    name.textContent = s.name;
    const time = document.createElement('time');
    if (s.at) { time.dateTime = s.at.toISOString(); time.textContent = fmt.format(s.at); }
    else time.textContent = '방금';
    head.append(name, time);
    const body = document.createElement('div');
    body.className = mono ? 'body mono' : 'body';
    body.textContent = s.content;
    row.append(head, body);
    box.append(row);
  }
}

async function submit(qid, ta, btn, status) {
  const name = who.value.trim();
  const content = ta.value.trim();
  const say = (kind, text) => { status.className = `status ${kind}`; status.textContent = text; };
  if (!name) { say('error', '위쪽 이름 칸을 먼저 채워 주세요.'); who.focus(); return; }
  if (!content) { say('error', '답안을 적은 뒤 제출하세요.'); ta.focus(); return; }
  if (!fb) { say('error', '저장소에 연결하지 못했어요. 새로고침 후 다시 시도하세요.'); return; }
  btn.disabled = true;
  say('', '제출하는 중');
  try {
    await fb.addDoc(fb.collection(fb.db, COLLECTION), { qid, name, content, createdAt: fb.serverTimestamp() });
    pushSub(qid, { name, content, at: new Date() });
    say('ok', '제출했어요. 이력에 추가됐습니다.');
    refresh(qid);
  } catch (e) {
    say('error', e?.code === 'permission-denied'
      ? '제출하지 못했어요. 이름은 30자, 답안은 2만 자까지입니다.'
      : '제출하지 못했어요. 잠시 후 다시 시도하세요.');
  } finally {
    btn.disabled = false;
  }
}

// ---------- 문항 그리기 ----------
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const pre = (text) => { const p = el('pre'); const c = el('code'); c.textContent = text; p.append(c); return p; };

function chips(item, kind) {
  const box = el('div', 'chips');
  const names = kind === 'quiz' ? [item.type] : item.chips;
  names.forEach((n) => box.append(el('span', 'chip', n)));
  if (kind === 'coding') box.append(el('span', 'chip case', item.case));
  else if (item.case) box.append(el('span', 'chip case', '토스증권 사례'));
  return box;
}

// kind: coding | quiz | text,  label: 번호 칸 위 글자,  no: 번호,  scope: 같은 문항 사본 구분용
function card(item, kind, label, no, scope) {
  const q = el('article', 'q');
  const num = el('div', 'q-no');
  num.append(el('span', 'k', label), el('span', 'n', String(no).padStart(2, '0')));
  const main = el('div', 'q-main');
  q.append(num, main);

  if (kind === 'coding') main.append(el('h3', null, item.title));
  main.append(chips(item, kind));
  main.append(el('div', 'q-text', kind === 'coding' ? item.body : `<p>${item.q}</p>`));
  if (kind === 'coding') {
    const io = el('div', 'field');
    io.append(el('span', 'io-label', '입출력 예'), pre(item.io));
    main.append(io);
  }

  const field = el('div', 'field');
  const ta = el('textarea', kind === 'coding' ? 'mono' : kind === 'quiz' ? 'short' : '');
  ta.id = `${scope}-${item.id}`;
  ta.dataset.draft = item.id;
  ta.maxLength = 20000;
  ta.spellcheck = kind !== 'coding';
  ta.value = local.get(`toss-draft:${item.id}`) || '';
  ta.addEventListener('input', () => {
    local.set(`toss-draft:${item.id}`, ta.value);
    document.querySelectorAll(`[data-draft="${item.id}"]`).forEach((t) => { if (t !== ta) t.value = ta.value; });
  });
  const lab = el('label', null, kind === 'coding' ? '내 풀이' : '내 답안');
  lab.htmlFor = ta.id;
  field.append(lab, ta);
  main.append(field);

  const actions = el('div', 'actions');
  const send = el('button', 'btn', '제출');
  send.type = 'button';
  const toggle = el('button', 'btn ghost', '제출 이력 ');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const count = el('span');
  count.dataset.count = item.id;
  toggle.append(count);
  const status = el('span', 'status');
  status.setAttribute('aria-live', 'polite');
  actions.append(send, toggle, status);
  main.append(actions);

  const hist = el('div', 'hist');
  hist.hidden = true;
  hist.dataset.hist = item.id;
  hist.id = `${scope}-hist-${item.id}`;
  toggle.setAttribute('aria-controls', hist.id);
  main.append(hist);

  send.addEventListener('click', () => submit(item.id, ta, send, status));
  toggle.addEventListener('click', () => {
    hist.hidden = !hist.hidden;
    toggle.setAttribute('aria-expanded', String(!hist.hidden));
    if (!hist.hidden) drawHistory(hist, item.id);
  });

  const model = el('details', 'model');
  model.append(el('summary', null, kind === 'coding' ? '접근법과 모범 풀이' : '모범답안'));
  const ans = el('div', 'ans');
  model.append(ans);
  // 펼칠 때 채워서, 답을 쓰기 전에 실수로 내용이 보이는 일을 줄인다
  model.addEventListener('toggle', () => {
    if (!model.open || ans.childElementCount) return;
    ans.innerHTML = kind === 'coding' ? item.approach : item.a;
    if (kind === 'coding') ans.append(pre(item.code));
    if (kind === 'quiz' && item.ref) ans.append(el('p', 'src', `더 깊게 보려면 ${item.ref.startsWith('코딩') ? '코딩 탭' : '서술형 탭'}의 ${item.ref}`));
  });
  main.append(model);

  refreshCount(count, item.id);
  return q;
}
const refreshCount = (node, qid) => { node.textContent = subsState === 'ready' ? String(subs.get(qid)?.length ?? 0) : ''; };

function renderBank() {
  CODING.forEach((it, i) => $('#list-coding').append(card(it, 'coding', '코딩', i + 1, 'bank')));
  QUIZ.forEach((it, i) => $('#list-quiz').append(card(it, 'quiz', '단답', i + 1, 'bank')));
  DESIGN.forEach((it, i) => $('#list-design').append(card(it, 'text', '설계', i + 1, 'bank')));
  CONCEPT.forEach((it, i) => $('#list-concept').append(card(it, 'text', '개념', i + 1, 'bank')));
  $('#n-coding').textContent = CODING.length;
  $('#n-quiz').textContent = QUIZ.length;
  $('#n-essay').textContent = DESIGN.length + CONCEPT.length;
}

// ---------- 모의고사 ----------
const pick = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

function drawPaper() {
  const paper = $('#mock-paper');
  paper.replaceChildren();
  const parts = [
    ['코딩', '1문항', pick(CODING, 1).map((it) => [it, 'coding'])],
    ['주관식', '5문항', pick(QUIZ, 5).map((it) => [it, 'quiz'])],
    ['서술형', '2문항 (설계 1, 개념 1)', [...pick(DESIGN, 1), ...pick(CONCEPT, 1)].map((it) => [it, 'text'])],
  ];
  for (const [name, meta, items] of parts) {
    const head = el('div', 'part');
    head.append(el('h2', null, name), el('span', 'muted', meta));
    const list = el('div', 'qlist');
    items.forEach(([it, kind], i) => list.append(card(it, kind, name, i + 1, 'mock')));
    paper.append(head, list);
  }
  resetTimer();
}

let remain = 90 * 60;
let ticking = null;
const timer = $('#timer');
const timerBtn = $('#btn-timer');
function showTime() {
  if (remain <= 0) { timer.textContent = '시간 종료'; timer.classList.add('over'); return; }
  timer.classList.remove('over');
  timer.textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
}
function resetTimer() {
  clearInterval(ticking);
  ticking = null;
  remain = Number($('#sel-min').value) * 60;
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
$('#btn-reset').addEventListener('click', resetTimer);
$('#sel-min').addEventListener('change', resetTimer);
$('#btn-draw').addEventListener('click', drawPaper);

// ---------- 탭 ----------
const TABS = ['trend', 'coding', 'quiz', 'essay', 'mock'];
function showTab(name, push) {
  if (!TABS.includes(name)) name = 'trend';
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  TABS.forEach((t) => { $(`#panel-${t}`).hidden = t !== name; });
  local.set('toss-tab', name);
  if (push) history.replaceState(null, '', `#${name}`);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  showTab(b.dataset.tab, true);
  const top = $('.mast').offsetHeight;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
}));

window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

renderBank();
drawPaper();
showTab(location.hash.slice(1) || local.get('toss-tab') || 'trend');

connect()
  .then(() => { subsState = 'ready'; })
  .catch((e) => { subsState = 'error'; console.error('Firestore 연결 실패', e); })
  .finally(() => {
    new Set([...CODING, ...QUIZ, ...DESIGN, ...CONCEPT].map((x) => x.id)).forEach(refresh);
  });
