const socket = io();
let content = null;
let currentSlide = 0;
let activePoll = null;

const $ = (id) => document.getElementById(id);

// ---- Bootstrap ----
fetch('/api/content').then(r => r.json()).then(c => {
  content = c;
  $('namaKelompok').textContent = c.namaKelompok || '';
  renderDots();
  renderSlide();
  socket.emit('presenter:join');
});

// ---- Dots & progress ----
function renderDots() {
  const wrap = $('slideDots');
  wrap.innerHTML = '';
  content.slides.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === currentSlide ? ' active' : i < currentSlide ? ' visited' : '');
    d.title = content.slides[i].title;
    d.style.cursor = 'pointer';
    d.onclick = () => socket.emit('presenter:goToSlide', i);
    wrap.appendChild(d);
  });
}

function updateProgress() {
  const pct = ((currentSlide) / (content.slides.length - 1)) * 100;
  $('progressFill').style.width = pct + '%';
  $('slideCounter').textContent = `${currentSlide + 1} / ${content.slides.length}`;
}

// ---- Main slide renderer ----
function renderSlide(direction = 'next') {
  if (!content) return;
  const slide = content.slides[currentSlide];
  const stage = $('stage');

  // Animate out existing wrapper
  const existing = stage.querySelector('.slide-wrapper');
  if (existing) {
    existing.classList.add('exit');
    setTimeout(() => existing.remove(), 280);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'slide-wrapper';

  // Route to correct renderer
  const type = slide.type || 'default';
  switch (type) {
    case 'cover':       wrapper.appendChild(buildCover(slide)); break;
    case 'definition':  wrapper.appendChild(buildDefinition(slide)); break;
    case 'formula':     wrapper.appendChild(buildFormula(slide)); break;
    case 'explanation': wrapper.appendChild(buildExplanation(slide)); break;
    case 'example':     wrapper.appendChild(buildExample(slide)); break;
    case 'summary':     wrapper.appendChild(buildSummary(slide)); break;
    default:            wrapper.appendChild(buildDefault(slide)); break;
  }

  // Poll box (shared across types)
  if (activePoll) {
    wrapper.appendChild(buildPollBox(activePoll));
  }

  setTimeout(() => {
    stage.appendChild(wrapper);
    stage.scrollTop = 0;
  }, existing ? 260 : 0);

  // Poll button visibility
  $('pollBtn').hidden = !slide.poll;
  updateProgress();
  renderDots();
  $('prevBtn').disabled = currentSlide === 0;
  $('nextBtn').disabled = currentSlide === content.slides.length - 1;
}

// ---- Slide builders ----

function buildCover(slide) {
  const div = document.createElement('div');
  div.className = 'slide-cover';

  // Pisahkan baris pertama (nama kelompok) dari anggota
  const bullets = slide.bullets || [];
  const kelompokLabel = bullets[0] || '';
  const anggota = bullets.slice(1);

  div.innerHTML = `
    <div class="cover-badge">${slide.namaKelompok || content.namaKelompok || 'Matematika Lanjut'}</div>
    <h1>${slide.title}</h1>
    <p class="cover-sub">${slide.subtitle || ''}</p>
    ${kelompokLabel ? `<div class="cover-group-label">${kelompokLabel}</div>` : ''}
    <div class="cover-topics">
      ${anggota.map(b => `<div class="topic-chip">${b}</div>`).join('')}
    </div>`;
  return div;
}

function buildDefinition(slide) {
  const div = document.createElement('div');
  div.className = 'slide-definition slide-two-col';
  // Left: text
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `
    <span class="def-icon">${slide.icon || '📌'}</span>
    <div class="slide-title-text">${slide.title}</div>
    ${slide.definition ? `<div class="def-box"><div class="def-label">Definisi</div>${slide.definition}</div>` : ''}`;
  if (slide.bullets && slide.bullets.length) left.appendChild(buildBullets(slide.bullets, 0.3));
  // Right: diagram
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = svgCircleDefinition();
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function buildFormula(slide) {
  const div = document.createElement('div');
  div.className = 'slide-formula slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `
    <div class="slide-title-text"><span class="title-icon">${slide.icon || '📐'}</span>${slide.title}</div>
    ${slide.context ? `<div class="formula-context">${slide.context}</div>` : ''}
    <div class="formula-box"><div class="formula-text">${slide.formula || ''}</div></div>`;
  if (slide.bullets && slide.bullets.length) left.appendChild(buildBullets(slide.bullets, 0.35));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  // Choose diagram by formula content
  if (slide.formula && slide.formula.includes('a') && slide.formula.includes('b')) {
    right.innerHTML = svgCircleAB();
  } else if (slide.formula && slide.formula.includes('x₁') && !slide.formula.includes('a')) {
    right.innerHTML = svgTangentOrigin();
  } else if (slide.formula && slide.formula.includes('x₁') && slide.formula.includes('a')) {
    right.innerHTML = svgTangentAB();
  } else if (slide.formula && slide.formula.includes('PT')) {
    right.innerHTML = svgExternalTangent();
  } else {
    right.innerHTML = svgCircleOrigin();
  }
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function buildExplanation(slide) {
  const div = document.createElement('div');
  div.className = 'slide-explanation slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `<span class="exp-icon">${slide.icon || '💡'}</span><div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) left.appendChild(buildBullets(slide.bullets, 0.2));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  // Explanation slides: show the "two cases" comparison diagram
  right.innerHTML = slide.title.includes('Garis') ? svgTwoFormulasTangent() : svgTwoFormulasCircle();
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function buildExample(slide) {
  const div = document.createElement('div');
  div.className = 'slide-example slide-two-col';
  const left = document.createElement('div');
  left.className = 'col-text';
  left.innerHTML = `<span class="ex-icon">${slide.icon || '✏️'}</span><div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) left.appendChild(buildBullets(slide.bullets, 0.15));
  const right = document.createElement('div');
  right.className = 'col-diagram';
  right.innerHTML = slide.title.includes('Garis') ? svgTangentExample() : svgCircleExample();
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function buildSummary(slide) {
  const div = document.createElement('div');
  div.className = 'slide-summary';
  div.innerHTML = `
    <div class="slide-title-text">
      <span class="title-icon">${slide.icon || '📝'}</span>${slide.title}
    </div>
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
  const remaining = (slide.bullets || []).slice(4);
  if (remaining.length) {
    div.appendChild(buildBullets(remaining, 0.3));
  }
  return div;
}

function buildDefault(slide) {
  const div = document.createElement('div');
  div.innerHTML = `<div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) {
    div.appendChild(buildBullets(slide.bullets));
  }
  return div;
}

function buildBullets(bullets, baseDelay = 0.15) {
  const ul = document.createElement('ul');
  ul.className = 'slide-bullets';
  bullets.forEach((b, i) => {
    const li = document.createElement('li');
    // Detect indented lines (start with spaces or special chars)
    const isIndented = b.startsWith('  ') || b.startsWith('   ');
    const isSectionHeader = b.startsWith('PERSAMAAN') || b.startsWith('GARIS') || b.startsWith('KUNCI');
    li.textContent = b.replace(/^[\s]+/, '');
    if (isIndented)     li.classList.add('indented');
    if (isSectionHeader) li.classList.add('section-header');
    li.style.animationDelay = (baseDelay + i * 0.07) + 's';
    ul.appendChild(li);
  });
  return ul;
}

// ================================================================
// SVG DIAGRAM BUILDERS
// ================================================================

/* Lingkaran pusat (0,0) — radius beranimasi tumbuh */
function svgCircleOrigin() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .dc { animation: drawCircle 1.2s 0.3s cubic-bezier(0.4,0,0.2,1) both; }
        .dr { animation: fadeUp2 0.6s 1.3s both; }
        .dl { animation: fadeUp2 0.5s 1.7s both; }
        @keyframes drawCircle {
          from { stroke-dashoffset: 502; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeUp2 {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      </style>
    </defs>
    <!-- grid -->
    <line x1="140" y1="20" x2="140" y2="260" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="20" y1="140" x2="260" y2="140" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <!-- circle -->
    <circle class="dc" cx="140" cy="140" r="80" fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="502" stroke-dashoffset="502"/>
    <!-- radius line -->
    <line class="dr" x1="140" y1="140" x2="211" y2="84" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 3"/>
    <!-- labels -->
    <circle class="dr" cx="140" cy="140" r="5" fill="#4FD1C5"/>
    <text class="dl" x="128" y="158" fill="#4FD1C5" font-size="13" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="dl" x="170" y="105" fill="#F5A623" font-size="13" font-family="IBM Plex Mono">r</text>
    <!-- point on circle -->
    <circle class="dr" cx="211" cy="84" r="4" fill="#F5A623"/>
    <text class="dl" x="216" y="80" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">(x,y)</text>
    <!-- formula label -->
    <text class="dl" x="60" y="252" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">x² + y² = r²</text>
  </svg>`;
}

/* Lingkaran pusat (a,b) */
function svgCircleAB() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .dc{animation:drawCircle2 1.2s 0.3s cubic-bezier(0.4,0,0.2,1) both;}
      .dr{animation:fadeUp2 0.6s 1.3s both;}
      .dl{animation:fadeUp2 0.5s 1.7s both;}
      @keyframes drawCircle2{from{stroke-dashoffset:502;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <line x1="30" y1="170" x2="260" y2="170" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="80" y1="20" x2="80" y2="260" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle class="dc" cx="160" cy="120" r="80" fill="none" stroke="#4FD1C5" stroke-width="2.5"
      stroke-dasharray="502" stroke-dashoffset="502"/>
    <!-- center cross -->
    <line class="dr" x1="150" y1="120" x2="170" y2="120" stroke="#fff" stroke-width="1.5"/>
    <line class="dr" x1="160" y1="110" x2="160" y2="130" stroke="#fff" stroke-width="1.5"/>
    <!-- radius -->
    <line class="dr" x1="160" y1="120" x2="226" y2="68" stroke="#F5A623" stroke-width="2" stroke-dasharray="5 3"/>
    <circle class="dr" cx="160" cy="120" r="5" fill="#4FD1C5"/>
    <text class="dl" x="164" y="138" fill="#4FD1C5" font-size="12" font-family="IBM Plex Mono">P(a,b)</text>
    <circle class="dr" cx="226" cy="68" r="4" fill="#F5A623"/>
    <text class="dl" x="231" y="64" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">(x,y)</text>
    <text class="dl" x="186" y="88" fill="#F5A623" font-size="13" font-family="IBM Plex Mono">r</text>
    <!-- dashed projections to axes -->
    <line class="dl" x1="160" y1="120" x2="160" y2="170" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="3 3"/>
    <line class="dl" x1="160" y1="120" x2="80" y2="120" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="3 3"/>
    <text class="dl" x="152" y="185" fill="rgba(255,255,255,0.5)" font-size="11" font-family="IBM Plex Mono">a</text>
    <text class="dl" x="62" y="124" fill="rgba(255,255,255,0.5)" font-size="11" font-family="IBM Plex Mono">b</text>
    <text class="dl" x="28" y="268" fill="rgba(255,255,255,0.4)" font-size="11" font-family="IBM Plex Mono">(x−a)²+(y−b)²=r²</text>
  </svg>`;
}

/* Garis singgung dari titik di lingkaran — pusat (0,0) */
function svgTangentOrigin() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .dc{animation:drawCircle3 1.2s 0.3s ease both;}
      .dt{animation:drawTangent 0.7s 1.4s ease both;}
      .dr{animation:fadeUp2 0.5s 1.3s both;}
      .dl{animation:fadeUp2 0.5s 1.8s both;}
      @keyframes drawCircle3{from{stroke-dashoffset:502;}to{stroke-dashoffset:0;}}
      @keyframes drawTangent{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <line x1="140" y1="20" x2="140" y2="260" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <line x1="20" y1="140" x2="260" y2="140" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle class="dc" cx="140" cy="140" r="80" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="502" stroke-dashoffset="502"/>
    <!-- radius to touch point T(3,4) scaled: T at ~(188, 76) -->
    <line class="dr" x1="140" y1="140" x2="188" y2="76" stroke="#F5A623" stroke-width="2" stroke-dasharray="4 3"/>
    <!-- tangent line (perpendicular to radius at T) -->
    <line class="dt" x1="220" y1="46" x2="156" y2="140" stroke="#a78bfa" stroke-width="2.5"
      stroke-dasharray="300" stroke-dashoffset="300"/>
    <!-- right angle mark -->
    <rect class="dr" x="183" y="71" width="10" height="10"
      fill="none" stroke="#a78bfa" stroke-width="1.5"
      transform="rotate(-53 188 76)"/>
    <!-- labels -->
    <circle class="dr" cx="140" cy="140" r="5" fill="#4FD1C5"/>
    <text class="dl" x="126" y="158" fill="#4FD1C5" font-size="12" font-family="IBM Plex Mono">O(0,0)</text>
    <circle class="dr" cx="188" cy="76" r="5" fill="#F5A623"/>
    <text class="dl" x="194" y="74" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">T(x₁,y₁)</text>
    <text class="dl" x="226" y="42" fill="#a78bfa" font-size="12" font-family="IBM Plex Mono">garis singgung</text>
    <text class="dl" x="44" y="268" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">x·x₁ + y·y₁ = r²</text>
  </svg>`;
}

/* Garis singgung — pusat (a,b) */
function svgTangentAB() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .dc{animation:drawCircle3 1.2s 0.3s ease both;}
      .dt{animation:drawTangent 0.7s 1.4s ease both;}
      .dr{animation:fadeUp2 0.5s 1.3s both;}
      .dl{animation:fadeUp2 0.5s 1.8s both;}
      @keyframes drawCircle3{from{stroke-dashoffset:502;}to{stroke-dashoffset:0;}}
      @keyframes drawTangent{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <circle class="dc" cx="155" cy="130" r="75" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="472" stroke-dashoffset="472"/>
    <line class="dr" x1="155" y1="130" x2="215" y2="68" stroke="#F5A623" stroke-width="2" stroke-dasharray="4 3"/>
    <line class="dt" x1="240" y1="38" x2="165" y2="120" stroke="#a78bfa" stroke-width="2.5"
      stroke-dasharray="300" stroke-dashoffset="300"/>
    <rect class="dr" x="210" y="63" width="10" height="10"
      fill="none" stroke="#a78bfa" stroke-width="1.5" transform="rotate(-45 215 68)"/>
    <circle class="dr" cx="155" cy="130" r="5" fill="#4FD1C5"/>
    <line class="dr" x1="145" y1="130" x2="165" y2="130" stroke="#fff" stroke-width="1.2"/>
    <line class="dr" x1="155" y1="120" x2="155" y2="140" stroke="#fff" stroke-width="1.2"/>
    <text class="dl" x="159" y="148" fill="#4FD1C5" font-size="12" font-family="IBM Plex Mono">P(a,b)</text>
    <circle class="dr" cx="215" cy="68" r="5" fill="#F5A623"/>
    <text class="dl" x="220" y="64" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">T(x₁,y₁)</text>
    <text class="dl" x="20" y="268" fill="rgba(255,255,255,0.4)" font-size="10" font-family="IBM Plex Mono">(x₁-a)(x-a)+(y₁-b)(y-b)=r²</text>
  </svg>`;
}

/* Garis tangen dari titik luar */
function svgExternalTangent() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .dc{animation:drawCircle3 1.2s 0.3s ease both;}
      .dt{animation:drawTangent 0.8s 1.4s ease both;}
      .dr{animation:fadeUp2 0.5s 1.2s both;}
      .dl{animation:fadeUp2 0.5s 1.8s both;}
      @keyframes drawCircle3{from{stroke-dashoffset:440;}to{stroke-dashoffset:0;}}
      @keyframes drawTangent{from{stroke-dashoffset:300;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <circle class="dc" cx="120" cy="140" r="70" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="440" stroke-dashoffset="440"/>
    <!-- Two tangent lines from external point P -->
    <line class="dt" x1="240" y1="140" x2="153" y2="79" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="300" stroke-dashoffset="300"/>
    <line class="dt" x1="240" y1="140" x2="153" y2="201" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="300" stroke-dashoffset="300"/>
    <!-- PT line label -->
    <line class="dr" x1="240" y1="140" x2="153" y2="140" stroke="#F5A623" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle class="dr" cx="120" cy="140" r="4" fill="#4FD1C5"/>
    <circle class="dr" cx="240" cy="140" r="5" fill="#F5A623"/>
    <circle class="dr" cx="153" cy="79" r="4" fill="#a78bfa"/>
    <circle class="dr" cx="153" cy="201" r="4" fill="#a78bfa"/>
    <text class="dl" x="104" y="158" fill="#4FD1C5" font-size="11" font-family="IBM Plex Mono">O</text>
    <text class="dl" x="244" y="145" fill="#F5A623" font-size="12" font-family="IBM Plex Mono">P(x₁,y₁)</text>
    <text class="dl" x="157" y="76" fill="#a78bfa" font-size="11" font-family="IBM Plex Mono">T₁</text>
    <text class="dl" x="157" y="218" fill="#a78bfa" font-size="11" font-family="IBM Plex Mono">T₂</text>
    <text class="dl" x="175" y="135" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">PT</text>
    <text class="dl" x="30" y="268" fill="rgba(255,255,255,0.4)" font-size="12" font-family="IBM Plex Mono">PT² = x₁²+y₁²−r²</text>
  </svg>`;
}

/* Dua kasus persamaan lingkaran berdampingan */
function svgTwoFormulasCircle() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .c1{animation:d1 1s 0.2s ease both;}
      .c2{animation:d2 1s 0.7s ease both;}
      .dr{animation:fadeUp2 0.5s 1.4s both;}
      .dl{animation:fadeUp2 0.5s 1.8s both;}
      @keyframes d1{from{stroke-dashoffset:251;}to{stroke-dashoffset:0;}}
      @keyframes d2{from{stroke-dashoffset:314;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0}to{opacity:1}}
    </style></defs>
    <!-- Left: pusat (0,0) -->
    <circle class="c1" cx="75" cy="130" r="40" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="251" stroke-dashoffset="251"/>
    <circle class="dr" cx="75" cy="130" r="4" fill="#4FD1C5"/>
    <text class="dl" x="62" y="148" fill="#4FD1C5" font-size="10" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="dl" x="30" y="200" fill="rgba(255,255,255,0.6)" font-size="11" font-family="IBM Plex Mono">x²+y²=r²</text>
    <!-- Right: pusat (a,b) -->
    <circle class="c2" cx="200" cy="120" r="50" fill="none" stroke="#F5A623" stroke-width="2"
      stroke-dasharray="314" stroke-dashoffset="314"/>
    <circle class="dr" cx="200" cy="120" r="4" fill="#F5A623"/>
    <line class="dr" x1="190" y1="120" x2="210" y2="120" stroke="#fff" stroke-width="1.2"/>
    <line class="dr" x1="200" y1="110" x2="200" y2="130" stroke="#fff" stroke-width="1.2"/>
    <text class="dl" x="204" y="138" fill="#F5A623" font-size="10" font-family="IBM Plex Mono">P(a,b)</text>
    <text class="dl" x="148" y="204" fill="rgba(255,255,255,0.6)" font-size="9.5" font-family="IBM Plex Mono">(x-a)²+(y-b)²=r²</text>
    <!-- Arrow: special case -->
    <text class="dl" x="100" y="258" fill="rgba(79,209,197,0.7)" font-size="11" font-family="IBM Plex Mono">a=0,b=0 → kasus khusus</text>
  </svg>`;
}

/* Dua kasus garis singgung berdampingan */
function svgTwoFormulasTangent() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .c1{animation:d1 1s 0.2s ease both;}
      .c2{animation:d2 1s 0.7s ease both;}
      .t1{animation:d3 0.7s 1.2s ease both;}
      .t2{animation:d3 0.7s 1.5s ease both;}
      .dr{animation:fadeUp2 0.5s 1.3s both;}
      .dl{animation:fadeUp2 0.5s 1.8s both;}
      @keyframes d1{from{stroke-dashoffset:251;}to{stroke-dashoffset:0;}}
      @keyframes d2{from{stroke-dashoffset:314;}to{stroke-dashoffset:0;}}
      @keyframes d3{from{stroke-dashoffset:200;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0}to{opacity:1}}
    </style></defs>
    <!-- Left circle + tangent at origin -->
    <circle class="c1" cx="75" cy="130" r="42" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="264" stroke-dashoffset="264"/>
    <line class="t1" x1="105" y1="82" x2="50" y2="168" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="200" stroke-dashoffset="200"/>
    <circle class="dr" cx="75" cy="130" r="3" fill="#4FD1C5"/>
    <circle class="dr" cx="107" cy="97" r="3" fill="#F5A623"/>
    <text class="dl" x="20" y="205" fill="rgba(255,255,255,0.6)" font-size="10" font-family="IBM Plex Mono">x·x₁+y·y₁=r²</text>
    <!-- Right circle + tangent shifted -->
    <circle class="c2" cx="200" cy="120" r="50" fill="none" stroke="#F5A623" stroke-width="2"
      stroke-dasharray="314" stroke-dashoffset="314"/>
    <line class="t2" x1="238" y1="68" x2="168" y2="168" stroke="#a78bfa" stroke-width="2"
      stroke-dasharray="200" stroke-dashoffset="200"/>
    <circle class="dr" cx="200" cy="120" r="3" fill="#F5A623"/>
    <circle class="dr" cx="238" cy="82" r="3" fill="#a78bfa"/>
    <text class="dl" x="130" y="248" fill="rgba(255,255,255,0.6)" font-size="9" font-family="IBM Plex Mono">(x₁-a)(x-a)+(y₁-b)(y-b)=r²</text>
  </svg>`;
}

/* Contoh soal lingkaran */
function svgCircleExample() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .e1{animation:drawE1 1s 0.3s ease both;}
      .e2{animation:drawE2 1s 0.9s ease both;}
      .dr{animation:fadeUp2 0.5s 1.5s both;}
      .dl{animation:fadeUp2 0.5s 2s both;}
      @keyframes drawE1{from{stroke-dashoffset:377;}to{stroke-dashoffset:0;}}
      @keyframes drawE2{from{stroke-dashoffset:220;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <!-- Circle 1: pusat (0,0) r=6 scaled -->
    <circle class="e1" cx="100" cy="150" r="60" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="377" stroke-dashoffset="377"/>
    <circle class="dr" cx="100" cy="150" r="4" fill="#4FD1C5"/>
    <line class="dr" x1="100" y1="150" x2="148" y2="102" stroke="#F5A623" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text class="dl" x="85" y="168" fill="#4FD1C5" font-size="11" font-family="IBM Plex Mono">(0,0)</text>
    <text class="dl" x="118" y="120" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">r=6</text>
    <!-- Circle 2: pusat (2,-3) r=5 scaled/offset -->
    <circle class="e2" cx="210" cy="120" r="35" fill="none" stroke="#F5A623" stroke-width="2"
      stroke-dasharray="220" stroke-dashoffset="220"/>
    <circle class="dr" cx="210" cy="120" r="4" fill="#F5A623"/>
    <line class="dr" x1="210" y1="120" x2="235" y2="95" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text class="dl" x="196" y="138" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">(2,-3)</text>
    <text class="dl" x="220" y="103" fill="#a78bfa" font-size="11" font-family="IBM Plex Mono">r=5</text>
    <text class="dl" x="50" y="268" fill="rgba(255,255,255,0.3)" font-size="10" font-family="IBM Plex Mono">② dan ① berdampingan</text>
  </svg>`;
}

/* Contoh soal garis singgung */
function svgTangentExample() {
  return `<svg class="diag-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      .ec{animation:drawE1 1.1s 0.3s ease both;}
      .et{animation:drawTanEx 0.8s 1.4s ease both;}
      .er{animation:fadeUp2 0.5s 1.2s both;}
      .el{animation:fadeUp2 0.5s 1.9s both;}
      @keyframes drawE1{from{stroke-dashoffset:628;}to{stroke-dashoffset:0;}}
      @keyframes drawTanEx{from{stroke-dashoffset:260;}to{stroke-dashoffset:0;}}
      @keyframes fadeUp2{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
    </style></defs>
    <!-- Circle x²+y²=100, r=10 scaled to 90 -->
    <circle class="ec" cx="140" cy="140" r="90" fill="none" stroke="#4FD1C5" stroke-width="2"
      stroke-dasharray="565" stroke-dashoffset="565"/>
    <!-- T(6,8) scaled: 6/10*90=54, 8/10*90=72 → (194, 68) -->
    <line class="er" x1="140" y1="140" x2="194" y2="68" stroke="#F5A623" stroke-width="2" stroke-dasharray="4 3"/>
    <!-- tangent perpendicular at T -->
    <line class="et" x1="230" y1="32" x2="140" y2="128" stroke="#a78bfa" stroke-width="2.5"
      stroke-dasharray="260" stroke-dashoffset="260"/>
    <!-- right angle -->
    <rect class="er" x="189" y="63" width="9" height="9"
      fill="none" stroke="#a78bfa" stroke-width="1.5" transform="rotate(-54 194 68)"/>
    <circle class="er" cx="140" cy="140" r="5" fill="#4FD1C5"/>
    <circle class="er" cx="194" cy="68" r="5" fill="#F5A623"/>
    <text class="el" x="125" y="158" fill="#4FD1C5" font-size="11" font-family="IBM Plex Mono">O(0,0)</text>
    <text class="el" x="198" y="65" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">T(6,8)</text>
    <text class="el" x="170" y="97" fill="#F5A623" font-size="11" font-family="IBM Plex Mono">r=10</text>
    <text class="el" x="30" y="265" fill="rgba(255,255,255,0.4)" font-size="11" font-family="IBM Plex Mono">6x + 8y = 100</text>
  </svg>`;
}

// ================================================================

function buildPollBox(poll) {
  const div = document.createElement('div');
  div.className = 'poll-box';
  div.id = 'pollBox';
  const total = poll.votes.reduce((a, b) => a + b, 0) || 1;
  const bars = poll.options.map((opt, i) => {
    const pct = Math.round((poll.votes[i] / total) * 100);
    return `<div class="poll-bar-row">
      <div class="poll-bar-label">${opt}</div>
      <div class="poll-bar-track"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
      <div class="poll-bar-count">${poll.votes[i]}</div>
    </div>`;
  }).join('');
  div.innerHTML = `<div class="poll-question">📊 ${poll.question}</div>${bars}`;
  return div;
}

// ---- Socket events ----
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
  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([e, n]) => `${e} ${n}`);
  $('reactionsSummary').textContent = parts.length ? parts.join('  ') : '—';
});

socket.on('poll:update', (poll) => {
  activePoll = poll;
  const existing = $('pollBox');
  if (!poll) {
    if (existing) existing.remove();
    $('pollBtn').hidden = !(content && content.slides[currentSlide].poll);
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

// ---- Controls ----
$('prevBtn').onclick = () => socket.emit('presenter:prevSlide');
$('nextBtn').onclick = () => socket.emit('presenter:nextSlide');
$('pollBtn').onclick = () => socket.emit('presenter:startPoll');
$('endPollBtn').onclick = () => socket.emit('presenter:endPoll');
$('endBtn').onclick = () => {
  if (confirm('Akhiri presentasi dan minta feedback dari semua peserta?')) {
    socket.emit('presenter:endPresentation');
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') socket.emit('presenter:nextSlide');
  if (e.key === 'ArrowLeft')                   socket.emit('presenter:prevSlide');
});
