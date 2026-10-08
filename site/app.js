const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const [notes, { coverage }] = await Promise.all([
  fetch('/data/notes.json').then((r) => r.json()),
  fetch('/data/coverage.json').then((r) => r.json()),
]).catch(() => [[], { coverage: [] }]);

const covered = coverage.filter((c) => c.noteCount > 0).length;
const authors = new Set(notes.map((n) => n.author));
$('#summary').innerHTML = `
  <span><b>${notes.length}</b> 노트</span>
  <span><b>${covered}/${coverage.length}</b> 토픽</span>
  <span><b>${authors.size}</b> 참여자</span>`;

const tracks = Map.groupBy(coverage, (c) => c.trackName);
$('#tracks').innerHTML = [...tracks].map(([name, topics]) => `
  <div class="track">
    <h3>${esc(name)}</h3>
    ${topics.map((t) => {
      const total = t.coveredConcepts.length + t.missingConcepts.length;
      const pct = total ? Math.round((t.coveredConcepts.length / total) * 100) : 0;
      return `<div class="topic" title="빠진 개념: ${esc(t.missingConcepts.join(', ') || '없음')}">
        <span>${esc(t.name)}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <span class="pct">${pct}%</span>
      </div>`;
    }).join('')}
  </div>`).join('');

const sorted = [...notes].sort((a, b) => String(b.date).localeCompare(String(a.date)));
$('#notes').innerHTML = sorted.length
  ? sorted.map((n, i) => `<li><button data-i="${i}">
      <b>${esc(n.title)}</b><span>${esc(n.topic)} · ${esc(n.author)} · ${esc(n.date ?? '')}</span>
    </button></li>`).join('')
  : '<li class="empty">아직 노트가 없어요. <code>/study</code> 로 첫 학습을 시작하세요.</li>';

$('#notes').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-i]');
  if (!btn) return;
  const n = sorted[btn.dataset.i];
  $('#note-body').innerHTML = `<h1>${esc(n.title)}</h1>
    <p class="meta">${esc(n.author)} · ${esc(n.topic)} · ${esc(n.date ?? '')}</p>
    ${marked.parse(n.body)}`;
  $('#viewer').showModal();
});
