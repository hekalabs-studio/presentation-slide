const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_QUESTIONS = 3;

function loadContent() {
  const raw = fs.readFileSync(path.join(__dirname, 'content.json'), 'utf-8');
  return JSON.parse(raw);
}
let content = loadContent();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/content', (req, res) => res.json(content));
app.get('/api/reload', (req, res) => {
  // Handy while editing content.json: reload without restarting the server
  content = loadContent();
  io.emit('content:reloaded', content);
  res.json({ ok: true, totalSlides: content.slides.length });
});

// ---- In-memory live state ----
let state = { currentSlide: 0, presentationEnded: false };
let participants = {};      // socketId -> { name, handRaised, questionsAsked }
let questions = [];         // { id, name, text, answered, ts }
let questionSeq = 1;
let reactionCounts = {};    // { emoji: count } — resets each slide change
let currentPoll = null;     // { question, options, votes:[...], voters:Set }
let ratings = [];           // { name, stars, feedback }

function participantSummary() {
  return Object.entries(participants).map(([id, p]) => ({
    id, name: p.name, handRaised: p.handRaised, questionsAsked: p.questionsAsked
  }));
}

function pollPublicState() {
  if (!currentPoll) return null;
  return {
    question: currentPoll.question,
    options: currentPoll.options,
    votes: currentPoll.votes,
    correct: currentPoll.correct,
    explanation: currentPoll.explanation,
    revealed: currentPoll.revealed
  };
}

io.on('connection', (socket) => {
  socket.on('presenter:join', () => {
    socket.join('presenter');
    socket.emit('state:update', { ...state, totalSlides: content.slides.length });
    socket.emit('participants:update', participantSummary());
    socket.emit('questions:update', questions);
    socket.emit('reactions:update', reactionCounts);
    socket.emit('poll:update', pollPublicState());
    socket.emit('ratings:update', ratings);
  });

  socket.on('audience:join', (name) => {
    participants[socket.id] = { name: (name || 'Tanpa nama').slice(0, 40), handRaised: false, questionsAsked: 0 };
    socket.join('audience');
    socket.emit('joined', {
      state: { ...state, totalSlides: content.slides.length },
      maxQuestions: MAX_QUESTIONS,
      questionsAsked: questions.length,
      poll: pollPublicState()
    });
    io.to('presenter').emit('participants:update', participantSummary());
  });

  socket.on('presenter:nextSlide', () => {
    if (state.currentSlide < content.slides.length - 1) {
      state.currentSlide++;
      reactionCounts = {};
      currentPoll = null;
      broadcastSlide();
    }
  });

  socket.on('presenter:prevSlide', () => {
    if (state.currentSlide > 0) {
      state.currentSlide--;
      reactionCounts = {};
      currentPoll = null;
      broadcastSlide();
    }
  });

  socket.on('presenter:goToSlide', (index) => {
    if (index >= 0 && index < content.slides.length) {
      state.currentSlide = index;
      reactionCounts = {};
      currentPoll = null;
      broadcastSlide();
    }
  });

  function broadcastSlide() {
    io.emit('state:update', { ...state, totalSlides: content.slides.length });
    io.emit('reactions:update', reactionCounts);
    io.emit('poll:update', null);
  }

  socket.on('audience:raiseHand', () => {
    const p = participants[socket.id];
    if (!p) return;
    p.handRaised = !p.handRaised;
    socket.emit('hand:state', p.handRaised);
    io.to('presenter').emit('participants:update', participantSummary());
  });

  socket.on('audience:question', (text) => {
    const p = participants[socket.id];
    if (!p) return;
    const clean = (text || '').trim().slice(0, 300);
    if (!clean) return;
    if (questions.length >= MAX_QUESTIONS) {
      socket.emit('question:rejected', { reason: 'session-limit' });
      return;
    }
    if (p.questionsAsked >= 1) {
      socket.emit('question:rejected', { reason: 'user-limit' });
      return;
    }
    p.questionsAsked++;
    const q = { id: questionSeq++, name: p.name, text: clean, answered: false, ts: Date.now() };
    questions.push(q);
    io.to('presenter').emit('questions:update', questions);
    socket.emit('question:accepted', { questionsAsked: p.questionsAsked, maxQuestions: 1, sessionRemaining: MAX_QUESTIONS - questions.length });
  });

  socket.on('presenter:markAnswered', (id) => {
    const q = questions.find(q => q.id === id);
    if (q) {
      q.answered = !q.answered;
      io.to('presenter').emit('questions:update', questions);
    }
  });

  socket.on('audience:reaction', (emoji) => {
    if (!['👍', '😂', '❓', '❤️'].includes(emoji)) return;
    reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    io.to('presenter').emit('reactions:update', reactionCounts);
  });

  socket.on('presenter:startPoll', () => {
    const slide = content.slides[state.currentSlide];
    if (!slide || !slide.poll) return;
    currentPoll = {
      question: slide.poll.question,
      options: slide.poll.options,
      votes: slide.poll.options.map(() => 0),
      voters: new Set(),
      correct: slide.poll.correct,
      explanation: slide.poll.explanation,
      revealed: false
    };
    io.emit('poll:update', pollPublicState());
  });

  socket.on('presenter:revealPoll', () => {
    if (!currentPoll) return;
    currentPoll.revealed = true;
    io.emit('poll:update', pollPublicState());
  });

  socket.on('presenter:endPoll', () => {
    currentPoll = null;
    io.emit('poll:update', null);
  });

  socket.on('audience:pollVote', (optionIndex) => {
    if (!currentPoll) return;
    if (currentPoll.voters.has(socket.id)) return;
    if (optionIndex < 0 || optionIndex >= currentPoll.options.length) return;
    currentPoll.voters.add(socket.id);
    currentPoll.votes[optionIndex]++;
    socket.emit('poll:voted', optionIndex);
    io.to('presenter').emit('poll:update', pollPublicState());
    io.to('audience').emit('poll:update', pollPublicState());
  });

  socket.on('presenter:endPresentation', () => {
    state.presentationEnded = true;
    io.to('audience').emit('presentation:ended');
  });

  socket.on('presenter:resetQuestions', () => {
    questions = [];
    questionSeq = 1;
    Object.values(participants).forEach(p => { p.questionsAsked = 0; });
    io.to('presenter').emit('questions:update', questions);
    io.to('audience').emit('questions:reset');
  });

  socket.on('audience:rating', ({ stars, feedback }) => {
    const p = participants[socket.id];
    ratings.push({ name: p ? p.name : 'Anonim', stars: Math.max(1, Math.min(5, Number(stars) || 0)), feedback: (feedback || '').slice(0, 500) });
    io.to('presenter').emit('ratings:update', ratings);
    socket.emit('rating:thanks');
  });

  socket.on('disconnect', () => {
    if (participants[socket.id]) {
      delete participants[socket.id];
      io.to('presenter').emit('participants:update', participantSummary());
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nServer jalan! Buka:`);
  console.log(`  Presenter (laptop) : http://localhost:${PORT}/presenter.html`);
  console.log(`  Daftar pertanyaan  : http://localhost:${PORT}/questions.html`);
  console.log(`  Kontroler (HP)     : http://<IP-laptop-kamu>:${PORT}/audience.html\n`);
});
