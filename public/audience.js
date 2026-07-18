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
function renderPoll(poll) {
  const card = el('pollCard');
  if (!poll) { card.hidden = true; return; }
  card.hidden = false;
  votedThisPoll = false;
  el('pollQ').textContent = poll.question;
  el('pollVoted').hidden = true;
  const optionsEl = el('pollOptions');
  optionsEl.innerHTML = '';
  poll.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'poll-option-btn';
    b.textContent = opt;
    b.onclick = () => {
      socket.emit('audience:pollVote', i);
      optionsEl.querySelectorAll('.poll-option-btn').forEach(x => x.disabled = true);
      b.classList.add('selected');
    };
    optionsEl.appendChild(b);
  });
}
socket.on('poll:update', renderPoll);
socket.on('poll:voted', () => { el('pollVoted').hidden = false; });

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
