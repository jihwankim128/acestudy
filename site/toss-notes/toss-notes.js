// Toss 노트: 팀원 탭(toss-notes/<github-id>/) → 그 팀원의 노트 트리 → 노트 본문, 오른쪽에 링크·백링크.
// 팀원 탭은 team.yaml 팀원과 toss-notes/ 아래 폴더에서 온다. 새 팀원은 자기 아이디 폴더만 만들면 된다.
import { questionLabel } from '/toss/groups.js';
import { notes, loadNotes, renderNote, keyOf, noteHref, memberHref, ofMember, backlinks, resolve } from '/toss/notes.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let member = null;
let current = null; // 열려 있는 노트 이름

function renderMembers() {
  $('#progress').textContent = notes.state === 'ready' ? `${notes.list.length}개` : '';
  $('#members').innerHTML = notes.members.map((m) => `<a href="${memberHref(m)}" class="${m === member ? 'active' : ''}">${esc(m)}<span class="n">${ofMember(m).length}</span></a>`).join('');
}

// 팀원 폴더 안의 하위 폴더를 트리 그룹으로 보여 준다 (폴더 없이 둔 노트는 "노트")
function renderTree() {
  const list = ofMember(member);
  const groups = new Map();
  for (const n of list) {
    if (!groups.has(n.folder)) groups.set(n.folder, []);
    groups.get(n.folder).push(n);
  }
  $('#tree').innerHTML = [...groups].map(([folder, ns]) => `<details open><summary><span class="dot" style="--c:var(--accent)"></span>${esc(folder || '노트')}
      <span class="count">${ns.length}</span></summary>
    ${ns.map((n) => `<a class="file ${current === n.name ? 'active' : ''}" href="${noteHref(n)}" title="${esc(n.title)}">
      <span class="check">◇</span><span class="label">${esc(n.title)}</span></a>`).join('')}
  </details>`).join('');
}

function renderIndex() {
  const view = $('#notes-view');
  const list = ofMember(member);
  let body;
  if (notes.state === 'loading') body = '<div class="skel"><i></i><i></i><i></i></div>';
  else if (notes.state === 'error') body = '<p class="muted">학습 노트를 불러오지 못했어요. 새로고침하세요.</p>';
  else if (!list.length) body = `<p class="muted">아직 노트가 없어요. 저장소에 <code>toss-notes/${esc(member)}/</code> 폴더를 만들고 md 파일을 커밋하면 여기에 나타나요.</p>`;
  else body = list.map((n) => {
    const back = backlinks(keyOf(n)).length;
    return `<a class="note-card" href="${noteHref(n)}"><b>${esc(n.title)}</b>
      <span class="muted small">${[n.folder, n.date, `링크 ${n.links.length}`, back ? `백링크 ${back}` : ''].filter(Boolean).map(esc).join(' · ')}</span>
      ${n.tags.length ? `<span>${n.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}</a>`;
  }).join('');
  view.innerHTML = `<div class="crumb">toss 노트 / ${esc(member)}</div><h1>${esc(member)}</h1>
    <div class="props"><span>노트 <b>${list.length}</b>개</span><span><code>toss-notes/${esc(member)}/</code></span></div>
    <blockquote><code>toss-notes/${esc(member)}/</code> 폴더를 옵시디언 vault 로 열고 정리하면, 커밋된 노트가 여기에 그대로 보여요.
      <code>[[노트 이름]]</code>, <code>[[c1]]</code> 같은 문항 id, <code>[[os.thread]]</code> 같은 CS 토픽으로 링크할 수 있어요.</blockquote>
    <div class="note-list">${body}</div>`;
}

const fileLink = (href, icon, label, extra = '') => `<a class="file" href="${esc(href)}"><span class="check">${icon}</span><span class="label">${esc(label)}</span>${extra}</a>`;

function renderSide() {
  const side = $('#side');
  const n = current && notes.byKey.get(`${member}/${current}`);
  if (!n) {
    side.innerHTML = `<h4>팀원별 노트</h4>${notes.members.map((m) => fileLink(memberHref(m), m === member ? '●' : '○', m, `<span class="owner">${ofMember(m).length}</span>`)).join('')}
      <h4>노트 쓰는 틀</h4><p class="empty">개념 하나에 노트 하나. 내 첫 답, 틀린 지점, 교정된 이해, 연결 순서로 써요.</p>`;
    return;
  }
  const out = n.links.map((t) => ({ t, r: resolve(t, n.member, questionLabel) }));
  const back = backlinks(keyOf(n));
  side.innerHTML = `<h4>링크<span class="n">${out.length}</span></h4>
    ${out.length ? out.map(({ t, r }) => r ? fileLink(r.href, '→', r.label)
      : `<span class="file unresolved"><span class="check">→</span><span class="label">${esc(t)}</span></span>`).join('')
      : '<p class="empty">이 노트에 [[링크]]가 없어요.</p>'}
    <h4>백링크<span class="n">${back.length}</span></h4>
    ${back.length ? back.map((b) => fileLink(noteHref(b), '◇', b.title, b.member !== n.member ? `<span class="owner">${esc(b.member)}</span>` : '')).join('')
      : '<p class="empty">이 노트를 가리키는 노트가 없어요.</p>'}`;
}

// ---------- 라우팅 (#/<github-id>, #/<github-id>/<노트 이름>) ----------
function go() {
  const [, m, name] = location.hash.split('/').map(decode);
  // 팀원이 없으면 마지막에 본 팀원 → 노트가 있는 첫 팀원 → 첫 팀원 순서로 연다
  const fallback = [local.get('toss-notes-member'), notes.members.find((x) => ofMember(x).length), notes.members[0]]
    .find((x) => x && notes.members.includes(x));
  member = m && (notes.members.includes(m) || notes.state !== 'ready') ? m : fallback ?? m ?? null;
  current = name || null;
  if (member) local.set('toss-notes-member', member);
  document.body.dataset.view = current ? 'note' : 'notes';
  renderMembers();
  renderTree();
  if (!member) $('#notes-view').innerHTML = '<h1>Toss 노트</h1><p class="muted">불러오는 중이에요.</p>';
  else if (current) renderNote($('#notes-view'), member, current, questionLabel);
  else renderIndex();
  $('#notes-view').scrollTop = 0;
  renderSide();
}
window.addEventListener('hashchange', go);

go();
loadNotes().then(go);
