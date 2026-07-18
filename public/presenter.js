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

function buildSummary(slide) {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="slide-title-text"><span class="title-icon">${slide.icon || '📝'}</span>${slide.title}</div>
    <div class="sum-grid">
      <div class="sum-card teal">
        <div class="sum-label">Persamaan Lingkaran</div>
        <div class="sum-formula">
          Pusat (0,0) &nbsp;→&nbsp; <span>x² + y² = r²</span><br>
          Pusat (a,b) &nbsp;→&nbsp; <span>(x−a)² + (y−b)² = r²</span>
        </div>
      </div>
      <div class="sum-card amber">
        <div class="sum-label">Garis Singgung di (x₁,y₁)</div>
        <div class="sum-formula">
          Pusat (0,0) &nbsp;→&nbsp; <span>x·x₁ + y·y₁ = r²</span><br>
          Pusat (a,b) &nbsp;→&nbsp; <span>(x₁−a)(x−a)+(y₁−b)(y−b)=r²</span>
        </div>
      </div>
    </div>`;
  const extra = (slide.bullets || []).slice(4);
  if (extra.length) div.appendChild(buildBullets(extra));
  return div;
}

function buildDefault(slide) {
  const div = document.createElement('div');
  div.innerHTML = `<div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets?.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildBullets(bullets, baseDelay = 0.1) {
  const ul = document.createElement('ul');
  ul.className = 'slide-bullets';
  bullets.forEach((b, i) => {
    const li = document.createElement('li');
    const isIndented = /^\s{2,}/.test(b);
    const isHeader = /^(PERSAMAAN|GARIS SINGGUNG|KUNCI)/.test(b);
    li.textContent = b.replace(/^\s+/, '');
    if (isIndented) li.classList.add('indented');
    if (isHeader)   li.classList.add('section-header');
    li.style.animationDelay = (baseDelay + i * 0.06) + 's';
    ul.appendChild(li);
  });
  return ul;
}

function buildPollBox(poll) {
  const div = document.createElement('div');
  div.className = 'poll-box'; div.id = 'pollBox';
  const total = poll.votes.reduce((a,b) => a+b, 0) || 1;
  div.innerHTML = `<div class="poll-question">📊 ${poll.question}</div>` +
    poll.options.map((opt, i) => {
      const pct = Math.round(poll.votes[i] / total * 100);
      return `<div class="poll-bar-row">
        <div class="poll-bar-label">${opt}</div>
        <div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
        <div class="poll-bar-count">${poll.votes[i]}</div>
      </div>`;
    }).join('');
  return div;
}

// ── SVG Diagrams ───────────────────────────────────────────────
// All SVGs use self-contained <style> so animations are isolated.

function svgWrap(content, viewBox='0 0 300 300') {
  return `<svg class="diag-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

const SVG_ANIM = `<style>
  .dc{stroke-dasharray:503;stroke-dashoffset:503;animation:dc 1.4s .3s ease forwards}
  .dc2{stroke-dasharray:440;stroke-dashoffset:440;animation:dc 1.4s .5s ease forwards}
  .fa{opacity:0;animation:fa .5s ease forwards}
  .fa1{animation-delay:.3s}.fa2{animation-delay:.8s}.fa3{animation-delay:1.1s}
  .fa4{animation-delay:1.3s}.fa5{animation-delay:1.5s}.fa6{animation-delay:1.7s}
  .gt{stroke-dasharray:250;stroke-dashoffset:250;animation:dc .7s 1.5s ease forwards}
  @keyframes dc{to{stroke-dashoffset:0}}
  @keyframes fa{to{opacity:1}}
</style>`;

// 1. Definisi lingkaran: circle tumbuh + pusat + titik + radius
function svgDefinition() {
  return svgWrap(`${SVG_ANIM}
    <line x1="150" y1="10" x2="150" y2="290" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="10" y1="150" x2="290" y2="150" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle class="dc" cx="150" cy="150" r="100" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="150" y1="150" x2="221" y2="79" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 4"/>
    <circle class="fa fa1" cx="150" cy="150" r="6" fill="#4FD1C5"/>
    <circle class="fa fa2" cx="221" cy="79" r="5" fill="#F5A623"/>
    <text class="fa fa3" x="154" y="170" fill="#4FD1C5" font-size="14" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="fa fa3" x="230" y="74" fill="#F5A623" font-size="14" font-family="IBM Plex Mono">(x,y)</text>
    <text class="fa fa4" x="178" y="110" fill="#F5A623" font-size="16" font-family="IBM Plex Mono" font-weight="bold">r</text>
    <text class="fa fa5" x="50" y="285" fill="rgba(255,255,255,0.35)" font-size="13" font-family="IBM Plex Mono">x² + y² = r²</text>
  `);
}

// 2. Circle shifted to (a,b)
function svgCircleAB() {
  return svgWrap(`${SVG_ANIM}
    <line x1="40" y1="10" x2="40" y2="290" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="10" y1="220" x2="290" y2="220" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle class="dc" cx="165" cy="130" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="165" y1="130" x2="228" y2="67" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 4"/>
    <line class="fa fa3" x1="165" y1="130" x2="165" y2="220" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="3 3"/>
    <line class="fa fa3" x1="40"  y1="130" x2="165" y2="130" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="3 3"/>
    <circle class="fa fa1" cx="165" cy="130" r="6" fill="#4FD1C5"/>
    <line class="fa fa1" x1="155" y1="130" x2="175" y2="130" stroke="#fff" stroke-width="1.5"/>
    <line class="fa fa1" x1="165" y1="120" x2="165" y2="140" stroke="#fff" stroke-width="1.5"/>
    <circle class="fa fa2" cx="228" cy="67" r="5" fill="#F5A623"/>
    <text class="fa fa3" x="169" y="150" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">P(a,b)</text>
    <text class="fa fa4" x="192" y="93" fill="#F5A623" font-size="16" font-family="IBM Plex Mono" font-weight="bold">r</text>
    <text class="fa fa4" x="157" y="240" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">a</text>
    <text class="fa fa4" x="18"  y="134" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">b</text>
    <text class="fa fa5" x="18" y="292" fill="rgba(255,255,255,0.35)" font-size="11" font-family="IBM Plex Mono">(x-a)²+(y-b)²=r²</text>
  `);
}

// 3. Tangent at origin
function svgTangentOrigin() {
  return svgWrap(`${SVG_ANIM}
    <line x1="150" y1="10" x2="150" y2="290" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="10" y1="150" x2="290" y2="150" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle class="dc" cx="150" cy="150" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="150" y1="150" x2="214" y2="78" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 4"/>
    <line class="gt" x1="248" y1="36" x2="162" y2="148" stroke="#a78bfa" stroke-width="2.5"/>
    <rect class="fa fa4" x="208" y="72" width="12" height="12" fill="none" stroke="#a78bfa" stroke-width="1.5" transform="rotate(-52 214 78)"/>
    <circle class="fa fa1" cx="150" cy="150" r="6" fill="#4FD1C5"/>
    <circle class="fa fa2" cx="214" cy="78" r="6" fill="#F5A623"/>
    <text class="fa fa3" x="120" y="172" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="fa fa3" x="218" y="74" fill="#F5A623" font-size="13" font-family="IBM Plex Mono">T(x₁,y₁)</text>
    <text class="fa fa5" x="18" y="292" fill="rgba(255,255,255,0.35)" font-size="12" font-family="IBM Plex Mono">x·x₁ + y·y₁ = r²</text>
  `);
}

// 4. Tangent at (a,b)
function svgTangentAB() {
  return svgWrap(`${SVG_ANIM}
    <circle class="dc" cx="155" cy="140" r="85" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="155" y1="140" x2="218" y2="72" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 4"/>
    <line class="gt" x1="256" y1="34" x2="164" y2="146" stroke="#a78bfa" stroke-width="2.5"/>
    <rect class="fa fa4" x="212" y="66" width="12" height="12" fill="none" stroke="#a78bfa" stroke-width="1.5" transform="rotate(-47 218 72)"/>
    <circle class="fa fa1" cx="155" cy="140" r="6" fill="#4FD1C5"/>
    <line class="fa fa1" x1="145" y1="140" x2="165" y2="140" stroke="#fff" stroke-width="1.5"/>
    <line class="fa fa1" x1="155" y1="130" x2="155" y2="150" stroke="#fff" stroke-width="1.5"/>
    <circle class="fa fa2" cx="218" cy="72" r="6" fill="#F5A623"/>
    <text class="fa fa3" x="159" y="160" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">P(a,b)</text>
    <text class="fa fa3" x="222" y="68" fill="#F5A623" font-size="13" font-family="IBM Plex Mono">T(x₁,y₁)</text>
    <text class="fa fa5" x="8" y="292" fill="rgba(255,255,255,0.35)" font-size="10" font-family="IBM Plex Mono">(x₁-a)(x-a)+(y₁-b)(y-b)=r²</text>
  `);
}

// 5. External tangent (PT)
function svgExternalTangent() {
  return svgWrap(`${SVG_ANIM}
    <circle class="dc2" cx="120" cy="150" r="80" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="gt" x1="256" y1="150" x2="168" y2="80" stroke="#a78bfa" stroke-width="2"/>
    <line class="gt" x1="256" y1="150" x2="168" y2="220" stroke="#a78bfa" stroke-width="2"/>
    <line class="fa fa4" x1="120" y1="150" x2="256" y2="150" stroke="#F5A623" stroke-width="1.5" stroke-dasharray="5 4"/>
    <circle class="fa fa1" cx="120" cy="150" r="5" fill="#4FD1C5"/>
    <circle class="fa fa2" cx="256" cy="150" r="6" fill="#F5A623"/>
    <circle class="fa fa3" cx="168" cy="80"  r="5" fill="#a78bfa"/>
    <circle class="fa fa3" cx="168" cy="220" r="5" fill="#a78bfa"/>
    <text class="fa fa4" x="104" y="168" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">O</text>
    <text class="fa fa4" x="260" y="155" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">P</text>
    <text class="fa fa5" x="172"  y="76"  fill="#a78bfa" font-size="12" font-family="IBM Plex Mono">T₁</text>
    <text class="fa fa5" x="172"  y="240" fill="#a78bfa" font-size="12" font-family="IBM Plex Mono">T₂</text>
    <text class="fa fa6" x="30" y="292" fill="rgba(255,255,255,0.35)" font-size="12" font-family="IBM Plex Mono">PT²=x₁²+y₁²−r²</text>
  `);
}

// 6. Two circles side by side (explanation)
function svgTwoCircles() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="80"  cy="150" r="60" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="377" stroke-dashoffset="377" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="215" cy="140" r="70" fill="none" stroke="#F5A623" stroke-width="2"
      stroke-dasharray="440" stroke-dashoffset="440" style="animation:dc 1.2s .6s ease forwards"/>
    <circle class="fa fa2" cx="80"  cy="150" r="5" fill="#4FD1C5"/>
    <circle class="fa fa3" cx="215" cy="140" r="5" fill="#F5A623"/>
    <line class="fa fa3" x1="205" y1="140" x2="225" y2="140" stroke="#fff" stroke-width="1.5"/>
    <line class="fa fa3" x1="215" y1="130" x2="215" y2="150" stroke="#fff" stroke-width="1.5"/>
    <text class="fa fa3" x="57"  y="168" fill="#4FD1C5" font-size="11" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="fa fa4" x="192" y="158" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">P(a,b)</text>
    <text class="fa fa4" x="14"  y="240" fill="#4FD1C5" font-size="10" font-family="IBM Plex Mono">x²+y²=r²</text>
    <text class="fa fa5" x="148" y="240" fill="#F5A623" font-size="10" font-family="IBM Plex Mono">(x-a)²+(y-b)²=r²</text>
    <text class="fa fa6" x="50"  y="285" fill="rgba(79,209,197,0.6)" font-size="11" font-family="IBM Plex Mono">a=0,b=0 → kasus khusus</text>
  `);
}

// 7. Two tangent lines (explanation)
function svgTwoTangents() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="75"  cy="145" r="55" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="346" stroke-dashoffset="346" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="215" cy="140" r="65" fill="none" stroke="#F5A623" stroke-width="2"
      stroke-dasharray="408" stroke-dashoffset="408" style="animation:dc 1.2s .5s ease forwards"/>
    <line x1="112" y1="98" x2="46"  y2="188" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="230" stroke-dashoffset="230" style="animation:dc .7s 1.4s ease forwards"/>
    <line x1="258" y1="88" x2="172" y2="188" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="230" stroke-dashoffset="230" style="animation:dc .7s 1.6s ease forwards"/>
    <circle class="fa fa2" cx="112" cy="98"  r="5" fill="#F5A623"/>
    <circle class="fa fa2" cx="258" cy="88"  r="5" fill="#F5A623"/>
    <text class="fa fa4" x="14"  y="268" fill="rgba(255,255,255,0.5)" font-size="10" font-family="IBM Plex Mono">x·x₁+y·y₁=r²</text>
    <text class="fa fa5" x="140" y="268" fill="rgba(255,255,255,0.5)" font-size="9"  font-family="IBM Plex Mono">(x₁-a)(x-a)+...=r²</text>
  `);
}

// 8. Circle example (soal)
function svgCircleEx() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="95"  cy="170" r="65" fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="408" stroke-dashoffset="408" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="220" cy="130" r="45" fill="none" stroke="#F5A623" stroke-width="2.5"
      stroke-dasharray="283" stroke-dashoffset="283" style="animation:dc 1.2s .7s ease forwards"/>
    <circle class="fa fa2" cx="95"  cy="170" r="5" fill="#4FD1C5"/>
    <circle class="fa fa3" cx="220" cy="130" r="5" fill="#F5A623"/>
    <line class="fa fa2" x1="95"  y1="170" x2="141" y2="124" stroke="#4FD1C5" stroke-width="1.5" stroke-dasharray="4 3"/>
    <line class="fa fa3" x1="220" y1="130" x2="252" y2="98"  stroke="#F5A623" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text class="fa fa4" x="72"  y="188" fill="#4FD1C5" font-size="12" font-family="IBM Plex Mono">(0,0)</text>
    <text class="fa fa4" x="224" y="148" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">(2,-3)</text>
    <text class="fa fa5" x="106" y="143" fill="#4FD1C5" font-size="12" font-family="IBM Plex Mono">r=6</text>
    <text class="fa fa5" x="236" y="110" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">r=5</text>
  `);
}

// 9. Tangent example (soal)
function svgTangentEx() {
  return svgWrap(`${SVG_ANIM}
    <line x1="150" y1="10" x2="150" y2="290" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="10"  y1="150" x2="290" y2="150" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle class="dc" cx="150" cy="150" r="100" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="150" y1="150" x2="210" y2="70" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 4"/>
    <line class="gt" x1="252" y1="20" x2="152" y2="145" stroke="#a78bfa" stroke-width="2.5"/>
    <rect class="fa fa4" x="204" y="64" width="13" height="13" fill="none" stroke="#a78bfa" stroke-width="1.5" transform="rotate(-53 210 70)"/>
    <circle class="fa fa1" cx="150" cy="150" r="6" fill="#4FD1C5"/>
    <circle class="fa fa2" cx="210" cy="70" r="6" fill="#F5A623"/>
    <text class="fa fa3" x="118" y="170" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="fa fa3" x="214" y="66" fill="#F5A623" font-size="13" font-family="IBM Plex Mono">T(6,8)</text>
    <text class="fa fa4" x="168" y="102" fill="#F5A623" font-size="14" font-family="IBM Plex Mono">r=10</text>
    <text class="fa fa6" x="22" y="291" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">6x + 8y = 100</text>
  `);
}

function pickFormulaDiagram(formula) {
  if (formula.includes('PT'))                             return svgExternalTangent();
  if (formula.includes('x₁') && formula.includes('a'))   return svgTangentAB();
  if (formula.includes('x₁'))                            return svgTangentOrigin();
  if (formula.includes('a') && formula.includes('b'))    return svgCircleAB();
  return svgDefinition();
}

// ── Socket events ──────────────────────────────────────────────
socket.on('state:update', (state) => {
  currentSlide = state.currentSlide;
  renderSlide();
});

socket.on('participants:update', (list) => {
  $('participantsCount').textContent = list.length;
  const raised = list.filter(p => p.handRaised);
  $('handsCount').textContent = raised.length;
  $('handsBadge').classList.toggle('active', raised.length > 0);
  $('handList').innerHTML = '';
  raised.forEach(p => {
    const d = document.createElement('div');
    d.className = 'hand-item';
    d.textContent = `✋ ${p.name}`;
    $('handList').appendChild(d);
  });
});

socket.on('reactions:update', (counts) => {
  const parts = Object.entries(counts).filter(([,n]) => n>0).map(([e,n]) => `${e} ${n}`);
  $('reactionsSummary').textContent = parts.length ? parts.join('  ') : '—';
});

socket.on('poll:update', (poll) => {
  activePoll = poll;
  const existing = $('pollBox');
  if (!poll) {
    if (existing) existing.remove();
    $('pollBtn').hidden = !(content?.slides[currentSlide]?.poll);
    $('endPollBtn').hidden = true;
    return;
  }
  $('pollBtn').hidden = true;
  $('endPollBtn').hidden = false;
  const wrapper = document.querySelector('.slide-wrapper');
  if (!wrapper) return;
  if (existing) existing.remove();
  wrapper.appendChild(buildPollBox(poll));
});

// ── Controls ───────────────────────────────────────────────────
$('prevBtn').onclick = () => nav('presenter:prevSlide');
$('nextBtn').onclick = () => nav('presenter:nextSlide');
$('pollBtn').onclick = () => socket.emit('presenter:startPoll');
$('endPollBtn').onclick = () => socket.emit('presenter:endPoll');
$('endBtn').onclick = () => {
  if (confirm('Akhiri presentasi dan minta feedback dari semua peserta?')) {
    socket.emit('presenter:endPresentation');
  }
};

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === ' ') nav('presenter:nextSlide');
  if (e.key === 'ArrowLeft') nav('presenter:prevSlide');
});
