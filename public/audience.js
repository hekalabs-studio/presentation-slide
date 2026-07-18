const socket = io();
let handRaised = false;
let questionsAsked = 0;
let maxQuestions = 3;
let votedThisPoll = false;

const el = (id) => document.getElementById(id);
const joinScreen = el('joinScreen');
const mainScreen = el('mainScreen');
const endScreen = el('endScreen');

fetch('/api/content').then(r => r.json()).then(c => {
  el('joinTitle').textContent = c.judulPresentasi || 'Gabung ke Sesi';
  el('joinKelompok').textContent = c.namaKelompok || '';
});

el('joinBtn').onclick = () => {
  const name = el('nameInput').value.trim() || 'Tanpa nama';
  socket.emit('audience:join', name);
};

socket.on('joined', ({ state, maxQuestions: mq, questionsAsked: qa, poll }) => {
  maxQuestions = mq;
  questionsAsked = qa;
  joinScreen.hidden = true;
  mainScreen.hidden = false;
  updateSlideInfo(state);
  updateQCounter();
  renderPoll(poll);
});

function updateSlideInfo(state) {
  el('slideInfo').textContent = `Slide ${state.currentSlide + 1}/${state.totalSlides}`;
}

socket.on('state:update', (state) => {
  updateSlideInfo(state);
  handRaised = false;
  el('handBtn').classList.remove('active');
  el('handLabel').textContent = 'Angkat Tangan';
});

// ---- Raise hand ----
el('handBtn').onclick = () => socket.emit('audience:raiseHand');
socket.on('hand:state', (state) => {
  handRaised = state;
  el('handBtn').classList.toggle('active', state);
  el('handLabel').textContent = state ? 'Turunkan Tangan' : 'Angkat Tangan';
});

// ---- Reactions ----
document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.onclick = () => {
    socket.emit('audience:reaction', btn.dataset.emoji);
    btn.style.transform = 'scale(1.15)';
    setTimeout(() => btn.style.transform = '', 150);
  };
});

// ---- Questions ----
function updateQCounter() {
  el('qCounter').textContent = `${questionsAsked}/${maxQuestions}`;
  el('askBtn').disabled = questionsAsked >= maxQuestions;
  el('qHint').textContent = questionsAsked >= maxQuestions ? 'Batas 3 pertanyaan sudah tercapai.' : '';
}

el('askBtn').onclick = () => {
  const text = el('questionInput').value.trim();
  if (!text) return;
  socket.emit('audience:question', text);
};

socket.on('question:accepted', ({ questionsAsked: qa, maxQuestions: mq }) => {
  questionsAsked = qa;
  maxQuestions = mq;
  el('questionInput').value = '';
  el('qHint').style.color = 'var(--teal)';
  el('qHint').textContent = 'Terkirim ke presenter ✓';
  updateQCounter();
  setTimeout(() => { if (questionsAsked < maxQuestions) el('qHint').textContent = ''; }, 2000);
});

socket.on('question:rejected', () => {
  el('qHint').style.color = 'var(--coral)';
  el('qHint').textContent = 'Batas 3 pertanyaan sudah tercapai.';
});

// ---- Poll ----
function removePollOverlay() {
  const existing = document.getElementById('audiencePollOverlay');
  if (existing) existing.remove();
  el('pollCard').hidden = true;
}

function renderPoll(poll) {
  removePollOverlay();
  if (!poll) return;
  votedThisPoll = false;
  const correctIdx = poll.correct != null ? poll.correct : -1;
  const optionsHtml = poll.options.map((opt, i) => {
    const isCorrect = i === correctIdx;
    const cls = isCorrect ? 'poll-opt-correct' : (correctIdx >= 0 ? 'poll-opt-wrong' : '');
    const icon = isCorrect ? '✅' : (correctIdx >= 0 ? '❌' : '');
    return `<button class="audience-poll-opt ${cls}" data-index="${i}" disabled>
      <span class="audience-poll-icon">${icon}</span>
      <span class="audience-poll-text">${opt}</span>
    </button>`;
  }).join('');
  const overlay = document.createElement('div');
  overlay.id = 'audiencePollOverlay';
  overlay.innerHTML = `
    <div class="audience-poll-overlay-inner">
      <div class="audience-poll-question">📊 ${poll.question}</div>
      <div class="audience-poll-countdown" id="audiencePollCountdown">⏱️ 60 detik tersisa</div>
      <div class="audience-poll-options" id="audiencePollOptions">${optionsHtml}</div>
      <div class="audience-poll-result" id="audiencePollResult" hidden>
        <div class="audience-poll-explanation">💡 ${poll.explanation || ''}</div>
        <button class="audience-poll-close" onclick="removePollOverlay()">Tutup</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const btns = overlay.querySelectorAll('.audience-poll-opt');
  const countdownEl = overlay.querySelector('#audiencePollCountdown');
  const optionsContainer = overlay.querySelector('#audiencePollOptions');
  const resultEl = overlay.querySelector('#audiencePollResult');
  let timeLeft = 60;
  const timer = setInterval(() => {
    timeLeft--;
    if (countdownEl) countdownEl.textContent = `⏱️ ${timeLeft} detik tersisa`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      if (countdownEl) countdownEl.hidden = true;
      btns.forEach(b => b.disabled = false);
      revealAudienceAnswers();
    }
  }, 1000);
  function revealAudienceAnswers() {
    btns.forEach((btn, i) => {
      const isCorrect = i === correctIdx;
      btn.classList.add(isCorrect ? 'poll-opt-correct' : 'poll-opt-wrong');
      const iconEl = btn.querySelector('.audience-poll-icon');
      if (iconEl) iconEl.textContent = isCorrect ? '✅' : '❌';
    });
    resultEl.hidden = false;
  }
  btns.forEach(btn => {
    btn.onclick = () => {
      if (votedThisPoll) return;
      votedThisPoll = true;
      const idx = Number(btn.dataset.index);
      socket.emit('audience:pollVote', idx);
      btn.classList.add('selected');
      btn.disabled = true;
    };
  });
}
socket.on('poll:update', renderPoll);
socket.on('poll:voted', () => {});

// ---- End of presentation -> rating ----
socket.on('presentation:ended', () => {
  mainScreen.hidden = true;
  endScreen.hidden = false;
});

let selectedStars = 0;
document.querySelectorAll('#starsInput span').forEach(star => {
  star.onclick = () => {
    selectedStars = Number(star.dataset.star);
    document.querySelectorAll('#starsInput span').forEach(s => {
      s.classList.toggle('filled', Number(s.dataset.star) <= selectedStars);
    });
  };
});

el('submitRatingBtn').onclick = () => {
  const feedback = el('feedbackInput').value.trim();
  socket.emit('audience:rating', { stars: selectedStars || 5, feedback });
};
socket.on('rating:thanks', () => {
  el('ratingThanks').hidden = false;
  el('submitRatingBtn').disabled = true;
});
