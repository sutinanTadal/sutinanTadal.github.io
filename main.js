// ── Game registry ──────────────────────────────────────────────
// To add a new game, push a new entry here.
const GAMES = [
  {
    id: 'set',
    title: 'SET',
    tag: 'Puzzle',
    icon: '🃏',
    desc: 'Find sets of 3 cards where each attribute is all the same or all different. A classic pattern-recognition game.',
    src: 'set-game/index.html',
    accent: 'accent-purple',
  },
  {
    id: 'tictactoe',
    title: 'OX Game',
    tag: 'Strategy',
    icon: '⭕',
    desc: 'Classic Tic-Tac-Toe with 2-player and vs-bot modes. Challenge the unbeatable minimax AI on hard mode.',
    src: 'tic-tac-toe/index.html',
    accent: 'accent-green',
  },
  {
    id: 'whogoesfirst',
    title: 'Who Goes First?',
    tag: 'TCG Tool',
    icon: '🃏',
    desc: 'Shuffle two face-down cards and pick one to decide who goes first in your TCG game. Fast, fair, and satisfying.',
    src: 'who-go-first/index.html',
    accent: 'accent-blue',
  },
  {
    id: 'moodtracker',
    title: 'BlueBubble',
    tag: 'Wellness',
    icon: '🫧',
    logo: 'mood-tracker/bluebubble.png',
    desc: 'BlueBubble — Track how you feel every day using Inside Out emotions. Log Joy, Sadness, Anxiety, and more — with notes, tags, and streaks.',
    src: 'mood-tracker/index.html',
    accent: 'accent-red',
  },
];

// ── Render nav buttons ─────────────────────────────────────────
const navButtons = document.getElementById('nav-game-buttons');
navButtons.style.display = 'flex';
navButtons.style.gap = '4px';

GAMES.forEach(game => {
  const btn = document.createElement('button');
  btn.className = 'nav-btn';
  btn.id = `nav-${game.id}`;
  const navIcon = game.logo ? `<img src="${game.logo}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;" />` : `<span>${game.icon}</span>`;
  btn.innerHTML = `${navIcon} ${game.title}`;
  btn.onclick = () => launchGame(game);
  navButtons.appendChild(btn);
});

// ── Render home cards ──────────────────────────────────────────
const grid = document.getElementById('games-grid');

GAMES.forEach(game => {
  const card = document.createElement('div');
  card.className = `game-card ${game.accent} fade`;
  card.innerHTML = `
    ${game.logo ? `<img class="card-icon" src="${game.logo}" style="width:48px;height:48px;object-fit:contain;" />` : `<span class="card-icon">${game.icon}</span>`}
    <span class="card-tag">${game.tag}</span>
    <div class="card-title">${game.title}</div>
    <div class="card-desc">${game.desc}</div>
    <button class="card-play-btn">Play ▶</button>
  `;
  card.onclick = () => launchGame(game);
  grid.appendChild(card);
});

// ── Navigation logic ───────────────────────────────────────────
let currentGame = null;
let navVisible  = true;

function setNavHidden(hidden) {
  navVisible = !hidden;
  document.getElementById('navbar').classList.toggle('nav-hidden', hidden);
  document.getElementById('content').classList.toggle('nav-hidden', hidden);
  document.getElementById('nav-fab').classList.toggle('visible', hidden);
}

function toggleNav() {
  setNavHidden(navVisible); // flip
}

function launchGame(game) {
  currentGame = game;

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`nav-${game.id}`);
  if (btn) btn.classList.add('active');

  document.getElementById('home').style.display = 'none';
  const view = document.getElementById('game-view');
  const frame = document.getElementById('game-frame');

  if (frame.dataset.current !== game.id) {
    frame.src = game.src;
    frame.dataset.current = game.id;
  }

  view.style.display = 'block';
  document.title = `${game.title} — AppLab`;
  setNavHidden(true);
}

function showHome() {
  currentGame = null;

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('game-view');
  view.style.display = 'none';

  const home = document.getElementById('home');
  home.style.display = 'flex';
  home.classList.remove('fade');
  void home.offsetWidth;
  home.classList.add('fade');

  document.title = 'AppLab';
  setNavHidden(false);
}
