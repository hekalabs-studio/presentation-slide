const socket = io();
let content = null;
let currentSlide = 0;
let activePoll = null;
let navCooldown = false;

const $ = (id) => document.getElementById(id);

// ---- Bootstrap ----
fetch('/api/content').then(r => r.json()).then(c => {
  content = c;
  $('namaKelompok').textContent = c.namaKelompok || '';
  renderDots();
  renderSlide();
  socket.emit('presenter:join');
});

// ---- Nav debounce ----
function nav(event) {
  if (navCooldown) return;
  navCooldown = true;
  socket.emit(event);
  setTimeout(() => { navCooldown = false; }, 600);
}

// ---- Dots & progress ----
function renderDots() {
  const wrap = $('slideDots');
  wrap.innerHTML = '';
  content.slides.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === currentSlide ? ' active' : i < currentSlide ? ' visited' : '');
    d.title = content.slides[i].title;
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
  const pct = ((currentSlide) / (content.slides.length - 1)) * 100;
  $('progressFill').style.width = pct + '%';
  $('slideCounter').textContent = `${currentSlide + 1} / ${content.slides.length}`;
}

// ---- Main slide renderer ----
function renderSlide(direction = 'next') {
  if (!content) return;
  const slide = content.slides[currentSlide];
  const stage = $('stage');

  const existing = stage.querySelector('.slide-wrapper');
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-wrapper';

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

  if (activePoll) {
    wrapper.appendChild(buildPollBox(activePoll));
  }

  if (existing) {
    existing.classList.add('exit');
    setTimeout(() => {
      existing.remove();
      stage.appendChild(wrapper);
    }, 300);
  } else {
    stage.appendChild(wrapper);
  }

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
  const kelompok = slide.kelompokLabel || slide.namaKelompok || content.namaKelompok || 'Kelompok 6';
  const anggota = slide.anggota || [];
  div.innerHTML = `
    <div class="cover-badge">${kelompok}</div>
    <h1>${slide.title}</h1>
    <p class="cover-sub">${slide.subtitle || ''}</p>
    ${anggota.length ? `<div class="cover-anggota">👥 Anggota :<br>${anggota.join('<br>')}</div>` : ''}
    <div class="cover-topics">
      ${(slide.bullets || []).map(b => `<div class="topic-chip">${b}</div>`).join('')}
    </div>`;
  return div;
}

function buildDefinition(slide) {
  const div = document.createElement('div');
  div.className = 'slide-definition';
  div.innerHTML = `
    <span class="def-icon">${slide.icon || '📌'}</span>
    <div class="slide-title-text">${slide.title}</div>
    ${slide.definition ? `
    <div class="def-box">
      <div class="def-label">Definisi</div>
      ${slide.definition}
    </div>` : ''}`;
  if (slide.bullets && slide.bullets.length) {
    div.appendChild(buildBullets(slide.bullets, 0.3));
  }
  return div;
}

function buildFormula(slide) {
  const div = document.createElement('div');
  div.className = 'slide-formula';
  div.innerHTML = `
    <div class="slide-title-text">
      <span class="title-icon">${slide.icon || '📐'}</span>${slide.title}
    </div>
    ${slide.context ? `<div class="formula-context">${slide.context}</div>` : ''}
    <div class="formula-box">
      <div class="formula-text">${slide.formula || ''}</div>
    </div>`;
  if (slide.bullets && slide.bullets.length) {
    div.appendChild(buildBullets(slide.bullets, 0.35));
  }
  return div;
}

function buildExplanation(slide) {
  const div = document.createElement('div');
  div.className = 'slide-explanation';
  div.innerHTML = `
    <span class="exp-icon">${slide.icon || '💡'}</span>
    <div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) {
    div.appendChild(buildBullets(slide.bullets, 0.2));
  }
  return div;
}

function buildExample(slide) {
  const div = document.createElement('div');
  div.className = 'slide-example';
  div.innerHTML = `
    <span class="ex-icon">${slide.icon || '✏️'}</span>
    <div class="slide-title-text">${slide.title}</div>`;
  if (slide.bullets && slide.bullets.length) {
    div.appendChild(buildBullets(slide.bullets, 0.15));
  }
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

function buildPollBox(poll) {
  const div = document.createElement('div');
  div.className = 'poll-overlay';
  div.id = 'pollOverlay';
  const correctIdx = poll.correct != null ? poll.correct : -1;
  const optionsHtml = poll.options.map((opt, i) => {
    return `<div class="poll-opt-row" data-index="${i}">
      <span class="poll-opt-text">${opt}</span>
      <span class="poll-opt-votes">${poll.votes[i]} suara</span>
    </div>`;
  }).join('');
  div.innerHTML = `
    <div class="poll-overlay-inner">
      <div class="poll-question-large">📊 ${poll.question}</div>
      <div class="poll-countdown" id="pollCountdown">⏱️ 60 detik tersisa</div>
      <div class="poll-options-large" id="pollOptionsContainer">${optionsHtml}</div>
      <div class="poll-explanation" id="pollExplanation" hidden>💡 ${poll.explanation || ''}</div>
      <div class="poll-actions">
        <button class="poll-reveal-btn" id="pollRevealBtn">Tunjukkan Jawaban</button>
        <button class="poll-close-btn" id="pollCloseBtn">Tutup Polling</button>
      </div>
    </div>`;
  const countdownEl = div.querySelector('#pollCountdown');
  const optionsContainer = div.querySelector('#pollOptionsContainer');
  const explanationEl = div.querySelector('#pollExplanation');
  let timeLeft = 60;
  const timer = setInterval(() => {
    timeLeft--;
    if (countdownEl) countdownEl.textContent = `⏱️ ${timeLeft} detik tersisa`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      if (countdownEl) countdownEl.hidden = true;
      revealPollAnswers();
    }
  }, 1000);
  function revealPollAnswers() {
    socket.emit('presenter:revealPoll');
    const rows = optionsContainer.querySelectorAll('.poll-opt-row');
    rows.forEach((row, i) => {
      const isCorrect = i === correctIdx;
      row.classList.add(isCorrect ? 'poll-opt-correct' : 'poll-opt-wrong');
      const iconEl = document.createElement('span');
      iconEl.className = 'poll-opt-icon';
      iconEl.textContent = isCorrect ? '✅' : '❌';
      row.insertBefore(iconEl, row.firstChild);
    });
    if (explanationEl) explanationEl.hidden = false;
  }
  div.querySelector('#pollRevealBtn').onclick = () => {
    clearInterval(timer);
    if (countdownEl) countdownEl.hidden = true;
    revealPollAnswers();
  };
  div.querySelector('#pollCloseBtn').onclick = () => {
    clearInterval(timer);
    const el = document.getElementById('pollOverlay');
    if (el) el.remove();
    socket.emit('presenter:endPoll');
  };
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
  const existing = $('pollOverlay');
  if (!poll) {
    if (existing) existing.remove();
    $('pollBtn').hidden = !(content && content.slides[currentSlide].poll);
    $('endPollBtn').hidden = true;
    return;
  }
  $('pollBtn').hidden = true;
  $('endPollBtn').hidden = false;
  if (existing) {
    const voteEls = existing.querySelectorAll('.poll-opt-votes');
    poll.votes.forEach((count, i) => {
      if (voteEls[i]) voteEls[i].textContent = `${count} suara`;
    });
  } else {
    document.body.appendChild(buildPollBox(poll));
  }
});

// ---- Controls ----
$('prevBtn').onclick = () => nav('presenter:prevSlide');
$('nextBtn').onclick = () => nav('presenter:nextSlide');
$('pollBtn').onclick = () => socket.emit('presenter:startPoll');
$('endPollBtn').onclick = () => socket.emit('presenter:endPoll');
$('resetQBtn').onclick = () => socket.emit('presenter:resetQuestions');
$('endBtn').onclick = () => {
  if (confirm('Akhiri presentasi dan minta feedback dari semua peserta?')) {
    socket.emit('presenter:endPresentation');
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') socket.emit('presenter:nextSlide');
  if (e.key === 'ArrowLeft')                   socket.emit('presenter:prevSlide');
});
