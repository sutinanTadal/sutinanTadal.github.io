const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

/* ── State ──────────────────────────────────────────────────── */
const state = {
  board:   Array(9).fill(null),
  current: 'X',
  over:    false,
  vsBot:   false,
  diff:    'easy',         // 'easy' | 'medium' | 'hard'
  scores:  { X: 0, O: 0, D: 0 }
};

/* ── DOM refs ───────────────────────────────────────────────── */
const cells       = document.querySelectorAll('.cell');
const boardEl     = document.getElementById('board');
const statusEl    = document.getElementById('status');
const scoreXEl    = document.getElementById('scoreX');
const scoreOEl    = document.getElementById('scoreO');
const scoreDrawEl = document.getElementById('scoreDraw');
const labelXEl    = document.getElementById('labelX');
const labelOEl    = document.getElementById('labelO');
const xIndEl      = document.getElementById('xInd');
const oIndEl      = document.getElementById('oInd');
const confettiEl  = document.getElementById('confetti');
const restartBtn  = document.getElementById('btnRestart');
const btn2p       = document.getElementById('btn2p');
const btnBotMode  = document.getElementById('btnBot');
const diffRow     = document.getElementById('diffRow');
const diffBtns    = document.querySelectorAll('.diff-btn');

/* ── Mode switching ─────────────────────────────────────────── */
btn2p.addEventListener('click', () => {
  state.vsBot = false;
  btn2p.classList.add('active');
  btnBotMode.classList.remove('active');
  diffRow.classList.add('hidden');
  labelOEl.textContent = 'O Wins';
  resetGame();
});

btnBotMode.addEventListener('click', () => {
  state.vsBot = true;
  btnBotMode.classList.add('active');
  btn2p.classList.remove('active');
  diffRow.classList.remove('hidden');
  labelOEl.textContent = 'Bot Wins';
  resetGame();
});

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.diff = btn.dataset.diff;
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    resetGame();
  });
});

/* ── Helpers ────────────────────────────────────────────────── */
function updateIndicators() {
  xIndEl.classList.toggle('active', state.current === 'X');
  oIndEl.classList.toggle('active', state.current === 'O');
}

function renderStatus(msg, type = '') {
  statusEl.className = 'status ' + type;
  statusEl.textContent = msg;
}

function renderThinking() {
  statusEl.className = 'status';
  statusEl.innerHTML = 'Bot is thinking <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
}

function checkWin(b, p) {
  return WINS.find(c => c.every(i => b[i] === p)) || null;
}
function isDraw(b) { return b.every(v => v !== null); }

/* ── Render a mark on a cell ────────────────────────────────── */
function placeMarkOnCell(cell, player) {
  cell.classList.add('taken', player.toLowerCase());
  if (player === 'O') {
    const ring = document.createElement('div');
    ring.className = 'o-ring';
    cell.appendChild(ring);
  }
}

/* ── Confetti ───────────────────────────────────────────────── */
function spawnConfetti() {
  const colors = ['#a78bfa','#67e8f9','#f472b6','#fbbf24','#6ee7b7','#818cf8'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      width:${6+Math.random()*10}px; height:${6+Math.random()*10}px;
      border-radius:${Math.random()>.5?'50%':'2px'};
      animation-duration:${1.5+Math.random()*2}s;
      animation-delay:${Math.random()*.6}s;
    `;
    confettiEl.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

/* ── Post-move resolution ───────────────────────────────────── */
function resolveAfterMove(player, isBot = false) {
  const winCombo = checkWin(state.board, player);
  if (winCombo) {
    state.over = true;
    state.scores[player]++;
    winCombo.forEach(i => cells[i].classList.add('win-cell'));
    boardEl.classList.add('game-over');
    const who = (state.vsBot && player === 'O') ? 'Bot Wins!' : `Player ${player} Wins!`;
    renderStatus(who + ' 🎉', 'win');
    updateScores();
    spawnConfetti();
    return true;
  }
  if (isDraw(state.board)) {
    state.over = true;
    state.scores.D++;
    renderStatus("It's a Draw!", 'draw');
    updateScores();
    return true;
  }
  return false;
}

function updateScores() {
  scoreXEl.textContent = state.scores.X;
  scoreOEl.textContent = state.scores.O;
  scoreDrawEl.textContent = state.scores.D;
}

/* ── Bot AI ─────────────────────────────────────────────────── */
function getEmptyCells(b) { return b.map((v,i) => v===null?i:-1).filter(i=>i>=0); }

// Easy: pure random
function botEasy(b) {
  const empty = getEmptyCells(b);
  return empty[Math.floor(Math.random() * empty.length)];
}

// Medium: win if can, block if must, else random
function botMedium(b) {
  for (const i of getEmptyCells(b)) {
    const t = [...b]; t[i] = 'O';
    if (checkWin(t, 'O')) return i;
  }
  for (const i of getEmptyCells(b)) {
    const t = [...b]; t[i] = 'X';
    if (checkWin(t, 'X')) return i;
  }
  const preferred = [4,0,2,6,8,1,3,5,7];
  for (const i of preferred) if (b[i] === null) return i;
  return botEasy(b);
}

// Hard: minimax (unbeatable)
function minimax(b, isMax, alpha, beta) {
  if (checkWin(b, 'O')) return { score: 10 };
  if (checkWin(b, 'X')) return { score: -10 };
  const empty = getEmptyCells(b);
  if (empty.length === 0) return { score: 0 };

  let best = isMax ? { score: -Infinity } : { score: Infinity };

  for (const i of empty) {
    b[i] = isMax ? 'O' : 'X';
    const res = minimax(b, !isMax, alpha, beta);
    b[i] = null;
    res.index = i;
    if (isMax) {
      if (res.score > best.score) best = res;
      alpha = Math.max(alpha, best.score);
    } else {
      if (res.score < best.score) best = res;
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function botHard(b) {
  return minimax([...b], true, -Infinity, Infinity).index;
}

function getBotMove() {
  const b = [...state.board];
  if (state.diff === 'easy')   return botEasy(b);
  if (state.diff === 'medium') return botMedium(b);
  return botHard(b);
}

/* ── Bot turn ───────────────────────────────────────────────── */
function doBotTurn() {
  boardEl.classList.add('bot-thinking');
  renderThinking();

  const delay = state.diff === 'easy' ? 400 : state.diff === 'medium' ? 600 : 900;

  setTimeout(() => {
    boardEl.classList.remove('bot-thinking');
    if (state.over) return;

    const idx = getBotMove();
    state.board[idx] = 'O';
    const cell = cells[idx];
    placeMarkOnCell(cell, 'O');
    cell.classList.add('bot-move');
    setTimeout(() => cell.classList.remove('bot-move'), 500);

    if (!resolveAfterMove('O', true)) {
      state.current = 'X';
      renderStatus("Your Turn (X)");
      updateIndicators();
    }
  }, delay);
}

/* ── Click handler ──────────────────────────────────────────── */
function handleClick(e) {
  const cell = e.currentTarget;
  const idx  = +cell.dataset.i;
  if (state.over || state.board[idx]) return;
  if (state.vsBot && state.current !== 'X') return;

  state.board[idx] = state.current;
  placeMarkOnCell(cell, state.current);

  if (resolveAfterMove(state.current)) return;

  if (state.vsBot) {
    state.current = 'O';
    updateIndicators();
    doBotTurn();
  } else {
    state.current = state.current === 'X' ? 'O' : 'X';
    renderStatus(`Player ${state.current}'s Turn`);
    updateIndicators();
  }
}

/* ── Reset ──────────────────────────────────────────────────── */
function resetGame() {
  state.board   = Array(9).fill(null);
  state.current = 'X';
  state.over    = false;
  boardEl.classList.remove('game-over', 'bot-thinking');

  cells.forEach(cell => {
    cell.className = 'cell';
    const ring = cell.querySelector('.o-ring');
    if (ring) ring.remove();
  });

  const msg = state.vsBot ? "Your Turn (X)" : "Player X's Turn";
  renderStatus(msg);
  updateIndicators();
}

cells.forEach(cell => cell.addEventListener('click', handleClick));
restartBtn.addEventListener('click', resetGame);
updateIndicators();
