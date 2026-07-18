const socket = io();
let questions = [];
let ratings = [];
let filter = 'all';

const listEl = document.getElementById('list');
const totalQEl = document.getElementById('totalQ');
const unansweredQEl = document.getElementById('unansweredQ');
const ratingSummaryEl = document.getElementById('ratingSummary');
const ratingListEl = document.getElementById('ratingList');

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filter = tab.dataset.filter;
    render();
  };
});

function render() {
  const filtered = questions.filter(q => {
    if (filter === 'unanswered') return !q.answered;
    if (filter === 'answered') return q.answered;
    return true;
  }).sort((a, b) => b.ts - a.ts);

  totalQEl.textContent = `${questions.length} pertanyaan`;
  unansweredQEl.textContent = `${questions.filter(q => !q.answered).length} belum dijawab`;

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty">Belum ada pertanyaan di kategori ini.</div>';
    return;
  }
  filtered.forEach(q => {
    const card = document.createElement('div');
    card.className = 'q-card' + (q.answered ? ' answered' : '');
    card.innerHTML = `
      <div class="q-main">
        <div class="q-name">${escapeHtml(q.name)} · ${new Date(q.ts).toLocaleTimeString('id-ID')}</div>
        <div class="q-text">${escapeHtml(q.text)}</div>
      </div>
      <button class="q-toggle">${q.answered ? 'Batal tandai' : 'Tandai dijawab'}</button>`;
    card.querySelector('.q-toggle').onclick = () => socket.emit('presenter:markAnswered', q.id);
    listEl.appendChild(card);
  });
}

function renderRatings() {
  if (ratings.length === 0) {
    ratingSummaryEl.textContent = 'Belum ada feedback masuk.';
    ratingListEl.innerHTML = '';
    return;
  }
  const avg = (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length).toFixed(1);
  ratingSummaryEl.textContent = `Rata-rata ${avg} / 5 dari ${ratings.length} respons`;
  ratingListEl.innerHTML = '';
  ratings.slice().reverse().forEach(r => {
    const item = document.createElement('div');
    item.className = 'rating-item';
    item.innerHTML = `<div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <div>${escapeHtml(r.feedback || '(tanpa komentar)')} <span style="color:var(--slate)">— ${escapeHtml(r.name)}</span></div>`;
    ratingListEl.appendChild(item);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

socket.emit('presenter:join');
socket.on('questions:update', (list) => { questions = list; render(); });
socket.on('ratings:update', (list) => { ratings = list; renderRatings(); });
