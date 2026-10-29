const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const load = (f) => fetch(`/data/${f}`).then((r) => r.json());

const [graph, notes, team] = await Promise.all([load('graph.json'), load('notes.json'), load('team.json')]);
const topicById = new Map(graph.topics.map((t) => [t.id, t]));
const noteById = new Map(notes.map((n) => [n.topic, n]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const catColor = (id) => css(`--c-${id}`) || css('--accent');

// ── 진행 현황 계산 ──
const catProgress = graph.categories.map((c) => {
  const items = graph.topics.filter((t) => t.category === c.id);
  const done = items.filter((t) => t.studied);
  return { ...c, items, done, pct: items.length ? Math.round((done.length / items.length) * 100) : 0, complete: items.length > 0 && done.length === items.length };
});
const meter = (pct, color) => `<span class="meter"><i style="width:${pct}%;background:${color}"></i></span>`;

// ── 사이드바 ──
const studied = graph.topics.filter((t) => t.studied).length;
$('#progress').textContent = `${studied}/${graph.topics.length}`;
$('#tree').innerHTML = catProgress.map((c) => `<details open><summary><span class="dot" style="--c:${catColor(c.id)}"></span>${esc(c.name)}
      ${c.complete ? '<span class="badge">완료</span>' : ''}<span class="count">${c.done.length}/${c.items.length}</span></summary>
    <div class="cat-meter">${meter(c.pct, catColor(c.id))}</div>
    ${c.items.map((t) => `<a class="file ${t.studied ? 'done' : ''}" href="#/topic/${t.id}" data-id="${t.id}">
      <span class="check">${t.studied ? '✓' : '○'}</span>${esc(t.title)}<span class="owner">${esc(t.owner ?? '')}</span></a>`).join('')}
  </details>`).join('');

// ── 현황 ──
function renderProgress() {
  const total = graph.topics.length;
  const pct = total ? Math.round((studied / total) * 100) : 0;
  const completeCats = catProgress.filter((c) => c.complete);
  $('#progress-view').innerHTML = `<h1>학습 현황</h1>
    <div class="overall">
      <div><span class="big">${pct}%</span><span class="muted"> · ${studied}/${total} 토픽</span></div>
      ${meter(pct, css('--accent'))}
      <p class="muted small">완료한 카테고리: ${completeCats.length ? completeCats.map((c) => `<b>${esc(c.name)}</b>`).join(', ') : '아직 없음'} (${completeCats.length}/${catProgress.length})</p>
    </div>
    <div class="cards">${catProgress.map((c) => `
      <section class="card ${c.complete ? 'complete' : ''}" style="--c:${catColor(c.id)}">
        <header><span class="dot" style="--c:${catColor(c.id)}"></span><b>${esc(c.name)}</b>
          ${c.complete ? '<span class="badge">완료</span>' : `<span class="muted small">${c.pct}%</span>`}
          <span class="count">${c.done.length}/${c.items.length}</span></header>
        ${meter(c.pct, catColor(c.id))}
        <ul>${c.items.map((t) => {
          const n = noteById.get(t.id);
          return `<li class="${t.studied ? 'done' : ''}"><a href="#/topic/${t.id}"><span class="check">${t.studied ? '✓' : '○'}</span>${esc(t.title)}</a>
            <span class="muted small">${t.studied ? `${esc(n?.author ?? '')} · ${esc(n?.date ?? '')}` : '미진행'}</span></li>`;
        }).join('')}</ul>
      </section>`).join('')}</div>`;
  $('#links').innerHTML = `<h4>팀원별 학습</h4>${memberStats().map(({ m, done, max }) => `<a class="side-member" href="#/team/${encodeURIComponent(m)}"><span>${esc(m)}</span><span class="muted small">${done}개</span>${meter(max ? (done / max) * 100 : 0, css('--accent'))}</a>`).join('')}`;
}

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

// ── 팀원 ──
// 토픽은 미리 배정하지 않는다. 팀원이 학습해 노트를 올린 토픽만 그 사람에게 연결된다.
function memberStats() {
  const stats = team.members.map((m) => ({ m, done: graph.topics.filter((t) => t.owner === m).length }));
  const max = Math.max(1, ...stats.map((s) => s.done));
  return stats.map((s) => ({ ...s, max }));
}

function renderTeam(focus) {
  $('#team-view').innerHTML = `<h1>팀원</h1>
    <p class="muted">토픽은 미리 배정하지 않아요. <code>/study</code>로 학습해 노트를 올린 토픽만 그 사람에게 연결됩니다.</p>
    ${memberStats().map(({ m, done }) => {
      const mine = graph.topics.filter((t) => t.owner === m)
        .sort((a, b) => String(noteById.get(b.id)?.date).localeCompare(String(noteById.get(a.id)?.date)));
      return `<section class="card member-card ${m === focus ? 'focus' : ''}" id="member-${esc(m)}">
        <header><b>${esc(m)}</b><span class="count">${done}개 학습</span></header>
        ${mine.length ? `<ul>${mine.map((t) => `<li class="done"><a href="#/topic/${t.id}"><span class="dot" style="--c:${catColor(t.category)}"></span>${esc(t.title)}</a>
          <span class="muted small">${esc(t.categoryName)} · ${esc(noteById.get(t.id)?.date ?? '')}</span></li>`).join('')}</ul>`
          : '<p class="muted small">아직 학습한 토픽이 없어요.</p>'}
      </section>`;
    }).join('')}`;
  $('#links').innerHTML = '';
  if (focus) document.getElementById(`member-${focus}`)?.scrollIntoView({ block: 'start' });
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
      ${n ? `<span>학습 <b>${esc(t.owner)}</b></span><span>작성 <b>${esc(n.date)}</b></span>` : '<span class="pending">미진행</span>'}
    </div>
    <blockquote>백엔드 관점 — ${esc(t.hook)}</blockquote>
    ${n?.vizUrl ? `<figure class="viz"><iframe src="${n.vizUrl}" sandbox="allow-scripts" loading="lazy" title="${esc(t.title)} 시각화"></iframe></figure>` : ''}
    ${n ? marked.parse(wiki(n.body)) : '<p class="muted">아직 아무도 학습하지 않았어요. 누군가 <code>/study</code>로 학습하면 그 사람이 이 토픽에 연결됩니다.</p>'}
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
  else if (view === 'team') renderTeam(arg ? decodeURIComponent(arg) : null);
  else if (view === 'progress') renderProgress();
  else { $('#links').innerHTML = `<h4>범례</h4><p class="muted small">노드 크기 = 연결 수<br>채워진 노드 = 학습 완료<br>빈 노드 = 학습 전</p>`; requestAnimationFrame(renderGraph); }
}
addEventListener('hashchange', route);
route();
