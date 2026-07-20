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
  el('qHint').textContent = questionsAsked >= maxQuestions ? 'Batas 3 pertanyaan sesi ini sudah tercapai.' : '';
}

el('askBtn').onclick = () => {
  const text = el('questionInput').value.trim();
  if (!text) return;
  socket.emit('audience:question', text);
};

socket.on('question:accepted', ({ questionsAsked: qa, maxQuestions: mq, sessionRemaining }) => {
  questionsAsked = sessionRemaining != null ? maxQuestions - sessionRemaining : qa;
  maxQuestions = mq || 3;
  el('questionInput').value = '';
  el('qHint').style.color = 'var(--teal)';
  el('qHint').textContent = 'Terkirim ke presenter ✓';
  updateQCounter();
  setTimeout(() => { if (questionsAsked < maxQuestions) el('qHint').textContent = ''; }, 2000);
});

socket.on('question:rejected', ({ reason }) => {
  if (reason === 'session-limit') {
    el('qHint').style.color = 'var(--coral)';
    el('qHint').textContent = 'Batas 3 pertanyaan sesi ini sudah tercapai.';
  } else if (reason === 'user-limit') {
    el('qHint').style.color = 'var(--coral)';
    el('qHint').textContent = 'Kamu hanya bisa mengirim 1 pertanyaan per sesi.';
  }
});

// ---- Poll ----
let audiencePollOverlay = null;
let audienceVoted = false;

function removePollOverlay() {
  if (audiencePollOverlay) {
    audiencePollOverlay.remove();
    audiencePollOverlay = null;
  }
  el('pollCard').hidden = true;
  audienceVoted = false;
}

function updateAudienceVoteCounts(poll) {
  if (!audiencePollOverlay) return;
  const voteSpans = audiencePollOverlay.querySelectorAll('.audience-poll-votes');
  poll.votes.forEach((count, i) => {
    if (voteSpans[i]) voteSpans[i].textContent = `${count} suara`;
  });
}

function createAudiencePoll(poll) {
  removePollOverlay();
  if (!poll) return;
  
  const optionsHtml = poll.options.map((opt, i) => {
    return `<button class="audience-poll-opt" data-index="${i}">
      <span class="audience-poll-text">${opt}</span>
      <span class="audience-poll-votes">0 suara</span>
    </button>`;
  }).join('');
  
  const overlay = document.createElement('div');
  overlay.id = 'audiencePollOverlay';
  overlay.className = 'audience-poll-overlay';
  overlay.innerHTML = `
    <div class="audience-poll-overlay-inner">
      <div class="audience-poll-question">📊 ${poll.question}</div>
      <div class="audience-poll-options">${optionsHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
  audiencePollOverlay = overlay;
  
  const btns = overlay.querySelectorAll('.audience-poll-opt');
  btns.forEach(btn => {
    btn.onclick = () => {
      if (audienceVoted) return;
      audienceVoted = true;
      const idx = Number(btn.dataset.index);
      socket.emit('audience:pollVote', idx);
      btns.forEach(b => b.disabled = true);
      btn.classList.add('selected');
    };
  });
}

socket.on('poll:update', (poll) => {
  if (!poll) {
    removePollOverlay();
    return;
  }
  if (audiencePollOverlay) {
    const currentQuestion = audiencePollOverlay.querySelector('.audience-poll-question');
    if (currentQuestion && currentQuestion.textContent.trim() !== poll.question) {
      createAudiencePoll(poll);
    } else {
      updateAudienceVoteCounts(poll);
    }
  } else {
    createAudiencePoll(poll);
  }
});
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
