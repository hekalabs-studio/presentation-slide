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

function svgWrap(content, viewBox='0 0 320 320') {
  return `<svg class="diag-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

const SVG_ANIM = `<style>
  .dc{stroke-dasharray:565;stroke-dashoffset:565;animation:dc 1.4s .3s ease forwards}
  .dc2{stroke-dasharray:471;stroke-dashoffset:471;animation:dc 1.4s .5s ease forwards}
  .fa{opacity:0;animation:fa .5s ease forwards}
  .fa1{animation-delay:.4s}.fa2{animation-delay:.9s}.fa3{animation-delay:1.1s}
  .fa4{animation-delay:1.3s}.fa5{animation-delay:1.5s}.fa6{animation-delay:1.8s}
  .gt{stroke-dasharray:300;stroke-dashoffset:300;animation:dc .7s 1.6s ease forwards}
  @keyframes dc{to{stroke-dashoffset:0}}
  @keyframes fa{to{opacity:1}}
</style>`;

// r=90 → 2π×90 ≈ 565  |  r=75 → 2π×75 ≈ 471

// 1. Definisi lingkaran
function svgDefinition() {
  return svgWrap(`${SVG_ANIM}
    <line x1="160" y1="20"  x2="160" y2="300" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="20"  y1="160" x2="300" y2="160" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle class="dc" cx="160" cy="160" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="160" y1="160" x2="224" y2="96" stroke="#F5A623" stroke-width="2.5" stroke-dasharray="6 4"/>
    <circle class="fa fa1" cx="160" cy="160" r="7"  fill="#4FD1C5"/>
    <circle class="fa fa2" cx="224" cy="96"  r="6"  fill="#F5A623"/>
    <text class="fa fa3" x="166" y="182" fill="#4FD1C5" font-size="15" font-family="monospace" font-weight="600">O(0,0)</text>
    <text class="fa fa3" x="230" y="92"  fill="#F5A623" font-size="14" font-family="monospace">(x,y)</text>
    <text class="fa fa4" x="186" y="120" fill="#F5A623" font-size="18" font-family="monospace" font-weight="700">r</text>
    <text class="fa fa5" x="44"  y="308" fill="rgba(255,255,255,0.45)" font-size="14" font-family="monospace">x² + y² = r²</text>
  `);
}

// 2. Circle shifted to (a,b)
function svgCircleAB() {
  return svgWrap(`${SVG_ANIM}
    <line x1="40"  y1="20"  x2="40"  y2="300" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="20"  y1="240" x2="300" y2="240" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle class="dc" cx="175" cy="145" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="175" y1="145" x2="239" y2="81"  stroke="#F5A623" stroke-width="2.5" stroke-dasharray="6 4"/>
    <line class="fa fa3" x1="175" y1="145" x2="175" y2="240" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <line class="fa fa3" x1="40"  y1="145" x2="175" y2="145" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle class="fa fa1" cx="175" cy="145" r="7" fill="#4FD1C5"/>
    <line class="fa fa1" x1="163" y1="145" x2="187" y2="145" stroke="#fff" stroke-width="2"/>
    <line class="fa fa1" x1="175" y1="133" x2="175" y2="157" stroke="#fff" stroke-width="2"/>
    <circle class="fa fa2" cx="239" cy="81" r="6" fill="#F5A623"/>
    <text class="fa fa3" x="180" y="167" fill="#4FD1C5" font-size="14" font-family="monospace" font-weight="600">P(a,b)</text>
    <text class="fa fa4" x="204" y="106" fill="#F5A623" font-size="18" font-family="monospace" font-weight="700">r</text>
    <text class="fa fa4" x="168" y="260" fill="rgba(255,255,255,0.5)" font-size="13" font-family="monospace">a</text>
    <text class="fa fa4" x="20"  y="149" fill="rgba(255,255,255,0.5)" font-size="13" font-family="monospace">b</text>
    <text class="fa fa5" x="20"  y="314" fill="rgba(255,255,255,0.4)" font-size="12" font-family="monospace">(x−a)²+(y−b)²=r²</text>
  `);
}

// 3. Tangent at origin
function svgTangentOrigin() {
  return svgWrap(`${SVG_ANIM}
    <line x1="160" y1="20"  x2="160" y2="300" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="20"  y1="160" x2="300" y2="160" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle class="dc" cx="160" cy="160" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="160" y1="160" x2="224" y2="96" stroke="#F5A623" stroke-width="2.5" stroke-dasharray="6 4"/>
    <line class="gt"  x1="268" y1="44"  x2="162" y2="166" stroke="#a78bfa" stroke-width="3"/>
    <rect class="fa fa4" x="218" y="90" width="13" height="13" fill="none" stroke="#a78bfa" stroke-width="2" transform="rotate(-46 224 96)"/>
    <circle class="fa fa1" cx="160" cy="160" r="7" fill="#4FD1C5"/>
    <circle class="fa fa2" cx="224" cy="96"  r="7" fill="#F5A623"/>
    <text class="fa fa3" x="124" y="182" fill="#4FD1C5" font-size="14" font-family="monospace" font-weight="600">O(0,0)</text>
    <text class="fa fa3" x="230" y="92"  fill="#F5A623" font-size="13" font-family="monospace">T(x₁,y₁)</text>
    <text class="fa fa5" x="16"  y="314" fill="rgba(255,255,255,0.4)" font-size="13" font-family="monospace">x·x₁ + y·y₁ = r²</text>
  `);
}

// 4. Tangent at (a,b)
function svgTangentAB() {
  return svgWrap(`${SVG_ANIM}
    <circle class="dc" cx="160" cy="155" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="160" y1="155" x2="228" y2="84" stroke="#F5A623" stroke-width="2.5" stroke-dasharray="6 4"/>
    <line class="gt"  x1="276" y1="34"  x2="166" y2="164" stroke="#a78bfa" stroke-width="3"/>
    <rect class="fa fa4" x="222" y="78" width="13" height="13" fill="none" stroke="#a78bfa" stroke-width="2" transform="rotate(-43 228 84)"/>
    <circle class="fa fa1" cx="160" cy="155" r="7" fill="#4FD1C5"/>
    <line class="fa fa1" x1="148" y1="155" x2="172" y2="155" stroke="#fff" stroke-width="2"/>
    <line class="fa fa1" x1="160" y1="143" x2="160" y2="167" stroke="#fff" stroke-width="2"/>
    <circle class="fa fa2" cx="228" cy="84"  r="7" fill="#F5A623"/>
    <text class="fa fa3" x="164" y="176" fill="#4FD1C5" font-size="14" font-family="monospace" font-weight="600">P(a,b)</text>
    <text class="fa fa3" x="234" y="80"  fill="#F5A623" font-size="13" font-family="monospace">T(x₁,y₁)</text>
    <text class="fa fa5" x="8"   y="314" fill="rgba(255,255,255,0.4)" font-size="11" font-family="monospace">(x₁-a)(x-a)+(y₁-b)(y-b)=r²</text>
  `);
}

// 5. External tangent (PT)
function svgExternalTangent() {
  return svgWrap(`${SVG_ANIM}
    <circle class="dc2" cx="120" cy="160" r="75" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="gt"  x1="270" y1="160" x2="178" y2="94"  stroke="#a78bfa" stroke-width="2.5"/>
    <line class="gt"  x1="270" y1="160" x2="178" y2="226" stroke="#a78bfa" stroke-width="2.5"/>
    <line class="fa fa4" x1="120" y1="160" x2="270" y2="160" stroke="#F5A623" stroke-width="2" stroke-dasharray="6 4"/>
    <circle class="fa fa1" cx="120" cy="160" r="6"  fill="#4FD1C5"/>
    <circle class="fa fa2" cx="270" cy="160" r="7"  fill="#F5A623"/>
    <circle class="fa fa3" cx="178" cy="94"  r="5"  fill="#a78bfa"/>
    <circle class="fa fa3" cx="178" cy="226" r="5"  fill="#a78bfa"/>
    <text class="fa fa4" x="102" y="178" fill="#4FD1C5" font-size="14" font-family="monospace" font-weight="600">O</text>
    <text class="fa fa4" x="274" y="165" fill="#F5A623" font-size="13" font-family="monospace">P</text>
    <text class="fa fa5" x="182" y="90"  fill="#a78bfa" font-size="13" font-family="monospace">T₁</text>
    <text class="fa fa5" x="182" y="248" fill="#a78bfa" font-size="13" font-family="monospace">T₂</text>
    <text class="fa fa6" x="30"  y="314" fill="rgba(255,255,255,0.4)" font-size="13" font-family="monospace">PT²=x₁²+y₁²−r²</text>
  `);
}

// 6. Two circles side by side
function svgTwoCircles() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="85"  cy="155" r="65"  fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="408" stroke-dashoffset="408" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="230" cy="148" r="75"  fill="none" stroke="#F5A623" stroke-width="2.5"
      stroke-dasharray="471" stroke-dashoffset="471" style="animation:dc 1.2s .6s ease forwards"/>
    <circle class="fa fa2" cx="85"  cy="155" r="6" fill="#4FD1C5"/>
    <circle class="fa fa3" cx="230" cy="148" r="6" fill="#F5A623"/>
    <line class="fa fa3" x1="218" y1="148" x2="242" y2="148" stroke="#fff" stroke-width="2"/>
    <line class="fa fa3" x1="230" y1="136" x2="230" y2="160" stroke="#fff" stroke-width="2"/>
    <text class="fa fa3" x="54"  y="174" fill="#4FD1C5" font-size="12" font-family="monospace">O(0,0)</text>
    <text class="fa fa4" x="204" y="168" fill="#F5A623" font-size="12" font-family="monospace">P(a,b)</text>
    <text class="fa fa5" x="20"  y="250" fill="#4FD1C5" font-size="11" font-family="monospace">x²+y²=r²</text>
    <text class="fa fa5" x="165" y="250" fill="#F5A623" font-size="10" font-family="monospace">(x-a)²+(y-b)²=r²</text>
    <text class="fa fa6" x="42"  y="298" fill="rgba(79,209,197,0.7)" font-size="12" font-family="monospace">a=0,b=0 → kasus khusus</text>
  `);
}

// 7. Two tangent lines
function svgTwoTangents() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="78"  cy="155" r="58"  fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="364" stroke-dashoffset="364" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="230" cy="148" r="70"  fill="none" stroke="#F5A623" stroke-width="2.5"
      stroke-dasharray="440" stroke-dashoffset="440" style="animation:dc 1.2s .5s ease forwards"/>
    <line x1="120" y1="106" x2="42"  y2="198" stroke="#a78bfa" stroke-width="2.5"
      stroke-dasharray="240" stroke-dashoffset="240" style="animation:dc .7s 1.4s ease forwards"/>
    <line x1="278" y1="92"  x2="184" y2="196" stroke="#a78bfa" stroke-width="2.5"
      stroke-dasharray="240" stroke-dashoffset="240" style="animation:dc .7s 1.6s ease forwards"/>
    <circle class="fa fa3" cx="120" cy="106" r="5" fill="#F5A623"/>
    <circle class="fa fa3" cx="278" cy="92"  r="5" fill="#F5A623"/>
    <text class="fa fa5" x="14"  y="280" fill="rgba(255,255,255,0.55)" font-size="11" font-family="monospace">x·x₁+y·y₁=r²</text>
    <text class="fa fa6" x="150" y="280" fill="rgba(255,255,255,0.55)" font-size="10" font-family="monospace">(x₁-a)(x-a)+...=r²</text>
  `);
}

// 8. Circle example
function svgCircleEx() {
  return svgWrap(`${SVG_ANIM}
    <circle cx="100" cy="180" r="70"  fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="440" stroke-dashoffset="440" style="animation:dc 1.2s .2s ease forwards"/>
    <circle cx="234" cy="135" r="50"  fill="none" stroke="#F5A623" stroke-width="2.5"
      stroke-dasharray="314" stroke-dashoffset="314" style="animation:dc 1.2s .7s ease forwards"/>
    <circle class="fa fa2" cx="100" cy="180" r="6" fill="#4FD1C5"/>
    <circle class="fa fa3" cx="234" cy="135" r="6" fill="#F5A623"/>
    <line class="fa fa2" x1="100" y1="180" x2="150" y2="130" stroke="#4FD1C5" stroke-width="2" stroke-dasharray="5 3"/>
    <line class="fa fa3" x1="234" y1="135" x2="270" y2="100" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 3"/>
    <text class="fa fa4" x="72"  y="200" fill="#4FD1C5" font-size="12" font-family="monospace">(0,0)</text>
    <text class="fa fa4" x="238" y="155" fill="#F5A623" font-size="12" font-family="monospace">(2,−3)</text>
    <text class="fa fa5" x="114" y="150" fill="#4FD1C5" font-size="13" font-family="monospace">r=6</text>
    <text class="fa fa5" x="258" y="114" fill="#F5A623" font-size="13" font-family="monospace">r=5</text>
  `);
}

// 9. Tangent example
function svgTangentEx() {
  return svgWrap(`${SVG_ANIM}
    <line x1="160" y1="20"  x2="160" y2="300" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="20"  y1="160" x2="300" y2="160" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle class="dc" cx="160" cy="160" r="90" fill="none" stroke="#4FD1C5" stroke-width="2.5"/>
    <line class="fa fa2" x1="160" y1="160" x2="214" y2="80"  stroke="#F5A623" stroke-width="2.5" stroke-dasharray="6 4"/>
    <line class="gt"  x1="260" y1="22"  x2="158" y2="158" stroke="#a78bfa" stroke-width="3"/>
    <rect class="fa fa4" x="208" y="74" width="13" height="13" fill="none" stroke="#a78bfa" stroke-width="2" transform="rotate(-54 214 80)"/>
    <circle class="fa fa1" cx="160" cy="160" r="7"  fill="#4FD1C5"/>
    <circle class="fa fa2" cx="214" cy="80"  r="7"  fill="#F5A623"/>
    <text class="fa fa3" x="120" y="182" fill="#4FD1C5" font-size="14" font-family="monospace" font-weight="600">O(0,0)</text>
    <text class="fa fa3" x="218" y="76"  fill="#F5A623" font-size="13" font-family="monospace">T(6,8)</text>
    <text class="fa fa4" x="172" y="110" fill="#F5A623" font-size="14" font-family="monospace">r=10</text>
    <text class="fa fa6" x="22"  y="312" fill="rgba(255,255,255,0.45)" font-size="13" font-family="monospace">6x + 8y = 100</text>
  `);
}

function pickFormulaDiagram(formula) {
  if (formula.includes('PT'))                           return svgExternalTangent();
  if (formula.includes('x₁') && formula.includes('a')) return svgTangentAB();
  if (formula.includes('x₁'))                          return svgTangentOrigin();
  if (formula.includes('a') && formula.includes('b'))  return svgCircleAB();
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
