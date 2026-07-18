/* presenter.js — stable rewrite */
const socket = io();
let content = null;
let currentSlide = 0;
let activePoll = null;
let rendering = false; // guard: prevent concurrent renders

const $ = (id) => document.getElementById(id);

// ── Bootstrap ──────────────────────────────────────────────────
fetch('/api/content').then(r => r.json()).then(c => {
  content = c;
  $('namaKelompok').textContent = c.namaKelompok || '';
  renderDots();
  updateProgress();
  renderSlide();
  socket.emit('presenter:join');
});

// ── Navigation guard ───────────────────────────────────────────
// All nav goes through server. Debounce to prevent double-fire.
let navCooldown = false;
function nav(event) {
  if (navCooldown) return;
  navCooldown = true;
  socket.emit(event);
  setTimeout(() => { navCooldown = false; }, 600);
}

// ── Dots & progress ────────────────────────────────────────────
function renderDots() {
  if (!content) return;
  const wrap = $('slideDots');
  wrap.innerHTML = '';
  content.slides.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === currentSlide ? ' active' : i < currentSlide ? ' visited' : '');
    d.title = s.title;
    d.style.cursor = 'pointer';
    d.onclick = () => { if (!navCooldown) { navCooldown = true; socket.emit('presenter:goToSlide', i); setTimeout(() => { navCooldown = false; }, 600); } };
    wrap.appendChild(d);
  });
}

function updateProgress() {
  if (!content) return;
  const total = content.slides.length - 1 || 1;
  $('progressFill').style.width = (currentSlide / total * 100) + '%';
  $('slideCounter').textContent = `${currentSlide + 1} / ${content.slides.length}`;
  $('prevBtn').disabled = currentSlide === 0;
  $('nextBtn').disabled = currentSlide === content.slides.length - 1;
}

// ── Main slide renderer ────────────────────────────────────────
function renderSlide() {
  if (!content || rendering) return;
  rendering = true;

  const slide = content.slides[currentSlide];
  const stage = $('stage');
  const existing = stage.querySelector('.slide-wrapper');

  const doRender = () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-wrapper';

    const type = slide.type || 'default';
    const builders = { cover: buildCover, definition: buildDefinition, formula: buildFormula,
      explanation: buildExplanation, example: buildExample, summary: buildSummary };
    wrapper.appendChild((builders[type] || buildDefault)(slide));

    if (activePoll) wrapper.appendChild(buildPollBox(activePoll));

    stage.appendChild(wrapper);
    stage.scrollTop = 0;

    // Update poll btn
    $('pollBtn').hidden = !slide.poll;
    renderDots();
    updateProgress();
    rendering = false;
  };

  if (existing) {
    existing.classList.add('exit');
    setTimeout(() => { existing.remove(); doRender(); }, 300);
  } else {
    doRender();
  }
}

// ── Slide builders ─────────────────────────────────────────────
function buildCover(slide) {
  const bullets = slide.bullets || [];
  const groupLabel = bullets[0] || '';
  const members = bullets.slice(1);
  const div = document.createElement('div');
  div.className = 'slide-cover';
  div.innerHTML = `
    <div class="cover-badge">${content.namaKelompok || ''}</div>
    <h1>${slide.title}</h1>
    <p class="cover-sub">${slide.subtitle || ''}</p>
    ${groupLabel ? `<div class="cover-group-label">${groupLabel}</div>` : ''}
    <div class="cover-topics">
      ${members.map(b => `<div class="topic-chip">${b}</div>`).join('')}
    </div>`;
  return div;
}

function buildDefinition(slide) {
  const div = document.createElement('div');
  div.className = 'slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `
    <span class="slide-icon">${slide.icon || '📌'}</span>
    <div class="slide-title-text">${slide.title}</div>
    ${slide.definition ? `<div class="def-box"><div class="def-label">Definisi</div>${slide.definition}</div>` : ''}`;
  if (slide.bullets?.length) left.appendChild(buildBullets(slide.bullets));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = svgDefinition();
  div.appendChild(left); div.appendChild(right);
  return div;
}

function buildFormula(slide) {
  const div = document.createElement('div');
  div.className = 'slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `
    <div class="slide-title-text"><span class="title-icon">${slide.icon || '📐'}</span>${slide.title}</div>
    ${slide.context ? `<div class="formula-context">${slide.context}</div>` : ''}
    <div class="formula-box"><div class="formula-text">${slide.formula || ''}</div></div>`;
  if (slide.bullets?.length) left.appendChild(buildBullets(slide.bullets));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = pickFormulaDiagram(slide.formula || '');
  div.appendChild(left); div.appendChild(right);
  return div;
}

function buildExplanation(slide) {
  const div = document.createElement('div');
  div.className = 'slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `<span class="slide-icon">${slide.icon || '💡'}</span><div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets?.length) left.appendChild(buildBullets(slide.bullets));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = slide.title.includes('Garis') ? svgTwoTangents() : svgTwoCircles();
  div.appendChild(left); div.appendChild(right);
  return div;
}

function buildExample(slide) {
  const div = document.createElement('div');
  div.className = 'slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `<span class="slide-icon">${slide.icon || '✏️'}</span><div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets?.length) left.appendChild(buildBullets(slide.bullets));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = slide.title.includes('Garis') ? svgTangentEx() : svgCircleEx();
  div.appendChild(left); div.appendChild(right);
  return div;
}
