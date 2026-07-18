/* presenter.js */
const socket = io();
let content = null;
let currentSlide = 0;
let activePoll = null;

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

// ── Nav debounce ───────────────────────────────────────────────
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
    d.onclick = () => {
      if (navCooldown) return;
      navCooldown = true;
      socket.emit('presenter:goToSlide', i);
      setTimeout(() => { navCooldown = false; }, 600);
    };
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

// ── Main renderer ──────────────────────────────────────────────
function renderSlide() {
  if (!content) return;
  const slide = content.slides[currentSlide];
  if (!slide) return;

  const stage = $('stage');
  const existing = stage.querySelector('.slide-wrapper');

  function doRender() {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-wrapper';

    if      (slide.type === 'cover')       wrapper.appendChild(buildCover(slide));
    else if (slide.type === 'definition')  wrapper.appendChild(buildDefinition(slide));
    else if (slide.type === 'formula')     wrapper.appendChild(buildFormula(slide));
    else if (slide.type === 'explanation') wrapper.appendChild(buildExplanation(slide));
    else if (slide.type === 'example')     wrapper.appendChild(buildExample(slide));
    else if (slide.type === 'summary')     wrapper.appendChild(buildSummary(slide));
    else                                   wrapper.appendChild(buildDefault(slide));

    if (activePoll) wrapper.appendChild(buildPollBox(activePoll));

    stage.appendChild(wrapper);
    stage.scrollTop = 0;
    $('pollBtn').hidden = !slide.poll;
    renderDots();
    updateProgress();
  }

  if (existing) {
    existing.classList.add('exit');
    setTimeout(() => {
      if (existing.parentNode) existing.remove();
      doRender();
    }, 300);
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
    ${slide.kelompok ? `<div class="cover-group-label">${slide.kelompok}</div>` : (groupLabel ? `<div class="cover-group-label">${groupLabel}</div>` : '')}
    ${slide.anggota && slide.anggota.length ? `<div class="cover-anggota">${slide.anggota.join('<br>')}</div>` : ''}
    <div class="cover-topics">
      ${(slide.kelompok ? bullets : members).map(b => `<div class="topic-chip">${b}</div>`).join('')}
    </div>`;
  return div;
}

function buildDefinition(slide) {
  const div = document.createElement('div');
  div.innerHTML = `
    <span class="slide-icon">${slide.icon || '📌'}</span>
    <div class="slide-title-text">${slide.title}</div>
    ${slide.definition ? `<div class="def-box"><div class="def-label">Definisi</div>${slide.definition}</div>` : ''}`;
  if (slide.bullets && slide.bullets.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildFormula(slide) {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="slide-title-text">
      <span class="title-icon">${slide.icon || '📐'}</span>${slide.title}
    </div>
    ${slide.context ? `<div class="formula-context">${slide.context}</div>` : ''}
    <div class="formula-box"><div class="formula-text">${slide.formula || ''}</div></div>`;
  if (slide.bullets && slide.bullets.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildExplanation(slide) {
  const div = document.createElement('div');
  div.innerHTML = `
    <span class="slide-icon">${slide.icon || '💡'}</span>
    <div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildExample(slide) {
  const div = document.createElement('div');
  div.innerHTML = `
    <span class="slide-icon">${slide.icon || '✏️'}</span>
    <div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildSummary(slide) {
  const div = document.createElement('div');
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
  const extra = (slide.bullets || []).slice(4);
  if (extra.length) div.appendChild(buildBullets(extra));
  return div;
}

function buildDefault(slide) {
  const div = document.createElement('div');
  div.innerHTML = `<div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) div.appendChild(buildBullets(slide.bullets));
  return div;
}

function buildBullets(bullets) {
  const ul = document.createElement('ul');
  ul.className = 'slide-bullets';
  bullets.forEach((b, i) => {
    const li = document.createElement('li');
    const isIndented = /^\s{2,}/.test(b);
    const isHeader   = /^(PERSAMAAN|GARIS SINGGUNG|KUNCI)/.test(b);
    li.textContent = b.replace(/^\s+/, '');
    if (isIndented) li.classList.add('indented');
    if (isHeader)   li.classList.add('section-header');
    li.style.animationDelay = (0.1 + i * 0.07) + 's';
    ul.appendChild(li);
  });
  return ul;
}

function buildPollBox(poll) {
  const div = document.createElement('div');
  div.className = 'poll-box';
  div.id = 'pollBox';
  const total = poll.votes.reduce((a, b) => a + b, 0) || 1;
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
  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([e, n]) => `${e} ${n}`);
  $('reactionsSummary').textContent = parts.length ? parts.join('  ') : '—';
});

socket.on('poll:update', (poll) => {
  activePoll = poll;
  const existing = $('pollBox');
  if (!poll) {
    if (existing) existing.remove();
    $('pollBtn').hidden = !(content && content.slides[currentSlide] && content.slides[currentSlide].poll);
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
