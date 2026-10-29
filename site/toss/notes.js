// Toss 학습 노트: toss-notes/<github-id>/ 의 옵시디언 md 를 읽기 전용으로 보여 준다 (빌드가 /data/toss-notes.json 으로 모은다).
// 옵시디언 문법 중 [[링크]], ![[이미지]], > [!콜아웃], ==강조==, ```mermaid 를 지원한다.
// Toss 노트 페이지와 Toss 스터디 문항 화면(이 문항을 다룬 노트)이 같이 쓴다.
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const enc = encodeURIComponent;

export const notes = { members: [], list: [], byKey: new Map(), attachments: {}, state: 'loading' };
export const keyOf = (n) => `${n.member}/${n.name}`;
export const noteHref = (n) => `/toss-notes/#/${enc(n.member)}/${enc(n.name)}`;
export const memberHref = (m) => `/toss-notes/#/${enc(m)}`;
export const ofMember = (m) => notes.list.filter((n) => n.member === m);

// [[이름]] 은 같은 팀원의 노트를 먼저 찾고, 없으면 다른 팀원의 노트에서 찾는다
function findNote(name, member) {
  return notes.byKey.get(`${member}/${name}`) ?? notes.list.find((n) => n.name === name) ?? null;
}

export async function loadNotes() {
  try {
    const res = await fetch('/data/toss-notes.json');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    notes.members = data.members;
    notes.list = data.notes;
    notes.attachments = data.attachments;
    notes.byKey = new Map(data.notes.map((n) => [keyOf(n), n]));
    for (const n of notes.list) n.out = n.links.map((t) => findNote(t, n.member)).filter(Boolean).map(keyOf);
    notes.state = 'ready';
  } catch (e) {
    notes.state = 'error';
    console.error('학습 노트를 불러오지 못했어요', e);
  }
}

// 이 노트(또는 문항 id)를 가리키는 노트들
export const backlinks = (key) => notes.list.filter((n) => keyOf(n) !== key && n.out.includes(key));
export const aboutQuestion = (qid) => notes.list.filter((n) => n.links.includes(qid) && !findNote(qid, n.member));

// [[대상]] 을 어디로 보낼지: 학습 노트 → 문항(c1, s3 ...) → CS 스터디 토픽(os.thread) 순서로 찾는다
export function resolve(target, member, question) {
  const n = findNote(target, member);
  if (n) return { href: noteHref(n), label: n.member === member ? target : `${target} (${n.member})` };
  const q = question(target);
  if (q) return { href: `/toss/#/q/${target}`, label: q };
  if (/^[a-z]+\.[a-z0-9.-]+$/.test(target)) return { href: `/#/topic/${target}`, label: target };
  return null;
}

// 첨부 이미지는 같은 팀원 폴더에서 먼저 찾는다
function attachment(target, member) {
  const base = target.split('/').pop();
  const keys = Object.keys(notes.attachments).filter((k) => k.split('/').pop() === base);
  const k = keys.find((x) => x.startsWith(`${member}/`)) ?? keys[0];
  return k ? notes.attachments[k] : null;
}

// 코드 블록과 인라인 코드 안은 건드리지 않는다
function obsidian(md, member, question) {
  return md.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) => i % 2 ? part : part
    .replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]+))?\]\]/g, (all, target, size) => {
      const url = attachment(target.trim(), member);
      if (url) return `<img src="${url}" alt="${esc(target)}"${/^\d+$/.test(size ?? '') ? ` width="${size}"` : ''} />`;
      return all.slice(1);
    })
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]+))?\]\]/g, (_, target, label) => {
      const r = resolve(target.trim(), member, question);
      const text = esc(label ?? r?.label ?? target.trim());
      return r ? `<a class="wikilink" href="${esc(r.href)}">${text}</a>` : `<span class="wikilink unresolved">${text}</span>`;
    })
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')).join('');
}

// > [!type]+/- 제목 → 콜아웃 상자. +/- 가 붙으면 접을 수 있다 (- 는 처음에 접힌 상태)
function callouts(root) {
  for (const bq of root.querySelectorAll('blockquote')) {
    const p = bq.firstElementChild;
    const m = p?.tagName === 'P' && p.innerHTML.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/);
    if (!m) continue;
    const [head, type, fold, title] = m;
    p.innerHTML = p.innerHTML.slice(head.length);
    if (!p.innerHTML.trim()) p.remove();
    const box = document.createElement(fold ? 'details' : 'div');
    box.className = 'callout';
    box.dataset.callout = type.toLowerCase();
    if (fold === '+') box.open = true;
    const titleEl = document.createElement(fold ? 'summary' : 'div');
    titleEl.className = 'callout-title';
    titleEl.innerHTML = title.trim() || esc(type[0].toUpperCase() + type.slice(1));
    const body = document.createElement('div');
    body.className = 'callout-body';
    body.append(...bq.childNodes);
    box.append(titleEl, body);
    bq.replaceWith(box);
  }
}

// ![](Pasted image.png) 처럼 상대 경로로 붙인 이미지도 첨부 폴더에서 찾는다
function images(root, member) {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (/^(https?:|data:|\/)/.test(src)) continue;
    const url = attachment(decodeURIComponent(src), member);
    if (url) img.src = url;
  }
}

let mermaid = null;
async function diagrams(root) {
  const codes = [...root.querySelectorAll('pre > code.language-mermaid')];
  if (!codes.length) return;
  try {
    if (!mermaid) {
      mermaid = (await import(MERMAID)).default;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });
    }
    const nodes = codes.map((code) => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
      return div;
    });
    await mermaid.run({ nodes });
  } catch (e) {
    console.error('mermaid 렌더링 실패', e);
  }
}

export function renderNote(view, member, name, question) {
  const n = notes.byKey.get(`${member}/${name}`);
  if (!n) {
    view.innerHTML = `<div class="crumb">${esc(member)}</div><h1>${esc(name)}</h1>
      <p class="muted">${notes.state === 'loading' ? '불러오는 중이에요.' : `아직 없는 노트예요. <code>toss-notes/${esc(member)}/</code> 에 같은 이름의 md 파일을 만들면 채워집니다.`}</p>`;
    return;
  }
  view.innerHTML = `<div class="crumb"><a href="${memberHref(n.member)}">${esc(n.member)}</a>${n.folder ? n.folder.split('/').map((f) => ` / ${esc(f)}`).join('') : ''}</div>
    <h1>${esc(n.title)}</h1>
    <div class="props">${n.date ? `<span>작성 <b>${esc(n.date)}</b></span>` : ''}
      ${n.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
      <span class="muted">${esc(n.path)}</span></div>
    <div class="md-note">${marked.parse(obsidian(n.body, n.member, question))}</div>`;
  const body = view.querySelector('.md-note');
  callouts(body);
  images(body, n.member);
  diagrams(body);
}
