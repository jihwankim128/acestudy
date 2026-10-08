const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const load = (f) => fetch(`/data/${f}`).then((r) => r.json());

const [graph, notes, schedule] = await Promise.all([load('graph.json'), load('notes.json'), load('schedule.json')]);
const topicById = new Map(graph.topics.map((t) => [t.id, t]));
const noteById = new Map(notes.map((n) => [n.topic, n]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const catColor = (id) => css(`--c-${id}`) || css('--accent');

// ── 사이드바 ──
const studied = graph.topics.filter((t) => t.studied).length;
$('#progress').textContent = `${studied}/${graph.topics.length}`;
$('#tree').innerHTML = graph.categories.map((c) => {
  const items = graph.topics.filter((t) => t.category === c.id);
  return `<details open><summary><span class="dot" style="--c:${catColor(c.id)}"></span>${esc(c.name)}
      <span class="count">${items.filter((t) => t.studied).length}/${items.length}</span></summary>
    ${items.map((t) => `<a class="file ${t.studied ? 'done' : ''}" href="#/topic/${t.id}" data-id="${t.id}">
      ${esc(t.title)}<span class="owner">${esc(t.owner ?? '')}</span></a>`).join('')}
  </details>`;
}).join('');

// ── 그래프 ──
let fg;
function renderGraph() {
  if (fg) return fg.width($('#graph').clientWidth).height($('#graph').clientHeight);
  const degree = new Map();
  graph.edges.forEach((e) => [e.source, e.target].forEach((id) => degree.set(id, (degree.get(id) ?? 0) + 1)));
  // 카테고리 허브: 옵시디언의 폴더처럼 같은 카테고리 노드를 느슨하게 묶는다
  const data = {
    nodes: [
      ...graph.categories.map((c) => ({ id: `cat:${c.id}`, hub: true, title: c.name, category: c.id, deg: 0 })),
      ...graph.topics.map((t) => ({ ...t, deg: degree.get(t.id) ?? 0 })),
    ],
    links: [
      ...graph.topics.map((t) => ({ source: t.id, target: `cat:${t.category}`, type: 'category' })),
      ...graph.edges.filter((e) => topicById.has(e.source) && topicById.has(e.target)).map((e) => ({ ...e })),
    ],
  };
  let hover = null;
  const neighbors = (n) => new Set(data.links.filter((l) => l.type !== 'category').flatMap((l) =>
    l.source.id === n.id ? [l.target.id] : l.target.id === n.id ? [l.source.id] : []));
  let near = new Set();

  fg = ForceGraph()($('#graph'))
    .graphData(data)
    .backgroundColor('rgba(0,0,0,0)')
    .nodeRelSize(4)
    .nodeVal((n) => 1 + n.deg * 0.6)
    .linkVisibility((l) => l.type !== 'category' || !hover)
    .linkColor((l) => (l.type === 'category' ? css('--edge-faint') : hover && (l.source.id === hover.id || l.target.id === hover.id) ? css('--accent') : css('--edge')))
    .linkLineDash((l) => (l.type === 'related' ? [2, 3] : null))
    .linkDirectionalArrowLength((l) => (l.type === 'prerequisite' ? 3 : 0))
    .linkDirectionalArrowRelPos(1)
    .nodeCanvasObject((n, ctx, scale) => {
      if (n.hub) {
        ctx.globalAlpha = hover ? 0.25 : 0.9;
        ctx.font = `600 ${13 / scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = catColor(n.category);
        ctx.fillText(n.title, n.x, n.y + 4 / scale);
        ctx.globalAlpha = 1;
        return;
      }
      const r = 3 + Math.sqrt(n.deg) * 1.6;
      const dim = hover && hover !== n && !near.has(n.id);
      ctx.globalAlpha = dim ? 0.2 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      if (n.studied) { ctx.fillStyle = catColor(n.category); ctx.fill(); }
      else { ctx.strokeStyle = catColor(n.category); ctx.lineWidth = 1.2; ctx.stroke(); }
      if (scale > 1.4 || hover === n || near.has(n.id)) {
        ctx.font = `${11 / scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = css('--fg-muted');
        ctx.fillText(n.title, n.x, n.y + r + 9 / scale);
      }
      ctx.globalAlpha = 1;
    })
    .nodePointerAreaPaint((n, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(n.x, n.y, 6 + Math.sqrt(n.deg) * 1.6, 0, 2 * Math.PI); ctx.fill();
    })
    .onNodeHover((n) => { if (n?.hub) n = null; hover = n; near = n ? neighbors(n) : new Set(); $('#graph').style.cursor = n ? 'pointer' : ''; })
    .onNodeClick((n) => { if (!n.hub) location.hash = `#/topic/${n.id}`; })
    .width($('#graph').clientWidth)
    .height($('#graph').clientHeight);
  fg.d3Force('charge').strength(-45);
  fg.d3Force('link').distance((l) => (l.type === 'category' ? 70 : 40)).strength((l) => (l.type === 'category' ? 0.15 : 0.5));
}
addEventListener('resize', () => fg && renderGraph());

// ── 배정표 ──
function renderSchedule() {
  const { members, sessions } = schedule;
  const progress = members.map((m) => {
    const mine = graph.topics.filter((t) => t.owner === m);
    const done = mine.filter((t) => t.studied).length;
    return `<div class="member"><b>${esc(m)}</b><span class="bar"><i style="width:${mine.length ? (done / mine.length) * 100 : 0}%"></i></span><span class="muted">${done}/${mine.length}</span></div>`;
  }).join('');
  $('#schedule-view').innerHTML = `<h1>배정표</h1>
    <p class="muted">세션마다 같은 카테고리 안에서 서로 다른 토픽을 랜덤 배정 (토픽당 10~20분)</p>
    <div class="members">${progress}</div>
    <table><thead><tr><th>#</th><th>카테고리</th>${members.map((m) => `<th>${esc(m)}</th>`).join('')}</tr></thead>
    <tbody>${sessions.map((s) => `<tr><td>${s.session}</td>
      <td><span class="dot" style="--c:${catColor(s.category)}"></span>${esc(graph.categories.find((c) => c.id === s.category)?.name ?? '혼합')}</td>
      ${members.map((m) => {
        const t = topicById.get(s.assignments[m]);
        return `<td>${t ? `<a class="${t.studied ? 'done' : ''}" href="#/topic/${t.id}">${t.studied ? '✓ ' : ''}${esc(t.title)}</a>` : ''}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
}

// ── 노트 ──
const wiki = (md) => md.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
  const t = topicById.get(id.trim());
  return `<a class="wikilink ${t?.studied ? '' : 'unresolved'}" href="#/topic/${esc(id.trim())}">${esc(label ?? t?.title ?? id)}</a>`;
});

function renderTopic(id) {
  const t = topicById.get(id);
  const n = noteById.get(id);
  if (!t) { $('#note-view').innerHTML = `<h1>${esc(id)}</h1><p class="muted">없는 토픽</p>`; return; }
  $('#note-view').innerHTML = `
    <div class="crumb">${esc(t.categoryName)} / ${esc(t.id)}</div>
    <h1>${esc(t.title)}</h1>
    <div class="props">
      <span>담당 <b>${esc(t.owner ?? '-')}</b></span><span>세션 <b>${t.session ?? '-'}</b></span>
      ${n ? `<span>작성 <b>${esc(n.date)}</b></span>` : '<span class="pending">학습 전</span>'}
    </div>
    <blockquote>백엔드 관점 — ${esc(t.hook)}</blockquote>
    ${n?.vizUrl ? `<figure class="viz"><iframe src="${n.vizUrl}" sandbox="allow-scripts" loading="lazy" title="${esc(t.title)} 시각화"></iframe></figure>` : ''}
    ${n ? marked.parse(wiki(n.body)) : '<p class="muted">아직 노트가 없어요. 담당자가 <code>/study</code> 로 학습하면 채워집니다.</p>'}
    ${n?.quiz?.length ? `<h3>복습 퀴즈</h3>${n.quiz.map((q) => `<details class="quiz">
      <summary>${q.level === 'interview' ? '<span class="tag">면접</span>' : ''}${esc(q.q)}</summary>
      <p>${esc(q.a)}</p></details>`).join('')}` : ''}
    ${n?.sources?.length ? `<h3>출처</h3><ul>${n.sources.map((s) => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></li>`).join('')}</ul>` : ''}`;
  renderLinks(id);
}

function renderLinks(id) {
  const group = (title, ids) => `<h4>${title} <span class="count">${ids.length}</span></h4>
    ${ids.length ? ids.map((x) => {
      const t = topicById.get(x);
      return `<a class="file ${t?.studied ? 'done' : 'unresolved'}" href="#/topic/${esc(x)}">${esc(t?.title ?? x)}</a>`;
    }).join('') : '<p class="muted small">없음</p>'}`;
  const e = graph.edges;
  $('#links').innerHTML = `
    ${group('선행 지식', e.filter((l) => l.type === 'prerequisite' && l.target === id).map((l) => l.source))}
    ${group('이어지는 지식', e.filter((l) => l.type === 'prerequisite' && l.source === id).map((l) => l.target))}
    ${group('관련', e.filter((l) => l.type === 'related' && (l.source === id || l.target === id)).map((l) => (l.source === id ? l.target : l.source)))}`;
}

// ── 라우팅 ──
function route() {
  const [, view = 'graph', arg] = location.hash.split('/');
  document.body.dataset.view = view;
  document.querySelectorAll('.views a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  document.querySelectorAll('.tree .file').forEach((a) => a.classList.toggle('active', a.dataset.id === arg));
  if (view === 'topic') renderTopic(decodeURIComponent(arg));
  else if (view === 'schedule') { $('#links').innerHTML = ''; renderSchedule(); }
  else { $('#links').innerHTML = `<h4>범례</h4><p class="muted small">노드 크기 = 연결 수<br>채워진 노드 = 학습 완료<br>빈 노드 = 학습 전</p>`; requestAnimationFrame(renderGraph); }
}
addEventListener('hashchange', route);
route();
