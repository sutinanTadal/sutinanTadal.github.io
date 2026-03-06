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
];

// ── Render nav buttons ─────────────────────────────────────────
const navButtons = document.getElementById('nav-game-buttons');
navButtons.style.display = 'flex';
navButtons.style.gap = '4px';

GAMES.forEach(game => {
  const btn = document.createElement('button');
  btn.className = 'nav-btn';
  btn.id = `nav-${game.id}`;
  btn.innerHTML = `<span>${game.icon}</span> ${game.title}`;
  btn.onclick = () => launchGame(game);
  navButtons.appendChild(btn);
});

// ── Render home cards ──────────────────────────────────────────
const grid = document.getElementById('games-grid');

GAMES.forEach(game => {
  const card = document.createElement('div');
  card.className = `game-card ${game.accent} fade`;
  card.innerHTML = `
    <span class="card-icon">${game.icon}</span>
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
  document.title = `${game.title} — Microgames`;
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

  document.title = 'Microgames';
}
