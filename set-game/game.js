/* ═══════════════════════════════════════════════════════════════
   SET GAME
═══════════════════════════════════════════════════════════════ */

const NUMBERS  = [1, 2, 3];
const SHAPES   = ['oval', 'diamond', 'squiggle'];
const COLORS   = ['#FF453A', '#32D74B', '#BF5AF2'];
const SHADINGS = ['solid', 'open', 'striped'];

// ── State ────────────────────────────────────────────────────
let deck       = [];
let board      = [];
let selected   = [];
let score      = 0;
let misses     = 0;
let hints      = 0;
let timerSecs  = 0;
let timerID    = null;
let hintTO     = null;
let gameOver   = false;
let busy       = false;
let hintIndices= [];
let cardIdSeq  = 0;
const cardElements = new Map();

// ── DOM ──────────────────────────────────────────────────────
const boardEl       = document.getElementById('board');
const scoreVal      = document.getElementById('scoreVal');
const timeVal       = document.getElementById('timeVal');
const deckVal       = document.getElementById('deckVal');
const hintsVal      = document.getElementById('hintsVal');
const btnHint       = document.getElementById('btnHint');
const btnDeal       = document.getElementById('btnDeal');
const noSetNotice   = document.getElementById('noSetNotice');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalScore    = document.getElementById('modalScore');
const modalTime     = document.getElementById('modalTime');
const modalHints    = document.getElementById('modalHints');
const toastWrap     = document.getElementById('toastWrap');
const startScreen   = document.getElementById('startScreen');

// ── Deck ─────────────────────────────────────────────────────
function makeDeck() {
  const d = [];
  for (const n of NUMBERS)
    for (const s of SHAPES)
      for (const c of COLORS)
        for (const sh of SHADINGS)
          d.push({ id: cardIdSeq++, number: n, shape: s, color: c, shading: sh });
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealFrom(n) {
  return deck.splice(0, Math.min(n, deck.length));
}

// ── SET logic ────────────────────────────────────────────────
function isSet(a, b, c) {
  return ['number','shape','color','shading'].every(attr => {
    const s = new Set([a[attr], b[attr], c[attr]]);
    return s.size === 1 || s.size === 3;
  });
}

function findSet(cards) {
  for (let i = 0; i < cards.length - 2; i++)
    for (let j = i + 1; j < cards.length - 1; j++)
      for (let k = j + 1; k < cards.length; k++)
        if (isSet(cards[i], cards[j], cards[k]))
          return [i, j, k];
  return null;
}

// ── Timer ────────────────────────────────────────────────────
function startTimer() {
  if (timerID) return;
  timerID = setInterval(() => { timerSecs++; timeVal.textContent = fmt(timerSecs); }, 1000);
}
function stopTimer() { clearInterval(timerID); timerID = null; }
function fmt(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

// ── Start / reset ────────────────────────────────────────────
function resetToStart() {
  stopTimer();
  hideModal();
  cardElements.forEach(el => el.remove());
  cardElements.clear();
  board = [];
  selected = [];
  score = 0; misses = 0; hints = 0; timerSecs = 0;
  gameOver = false; busy = false;
  hintIndices = [];
  cardIdSeq = 0;
  if (hintTO) { clearTimeout(hintTO); hintTO = null; }
  scoreVal.textContent = '0';
  hintsVal.textContent = '0';
  timeVal.textContent  = '0:00';
  deckVal.textContent  = '—';
  noSetNotice.textContent = '';
  btnHint.disabled = true;
  btnDeal.disabled = true;
  startScreen.classList.remove('hidden');
}

function startGame() {
  startScreen.classList.add('hidden');

  deck  = shuffle(makeDeck());
  board = dealFrom(12);
  while (!findSet(board) && deck.length >= 3) {
    board.push(...dealFrom(3));
  }
  updateDeckCount();

  board.forEach((card, idx) => {
    const el = createCardEl(card, idx * 40);
    cardElements.set(card.id, el);
    boardEl.appendChild(el);
  });

  updateFooter();
  startTimer();
}

// ── Card DOM ─────────────────────────────────────────────────
function createCardEl(card, animDelay = 0) {
  const el = document.createElement('div');
  el.className = 'card card-new';
  el.style.animationDelay = `${animDelay}ms`;
  el.dataset.cardId = card.id;
  el.appendChild(buildCardSVG(card));
  return el;
}

// Event delegation on board
boardEl.addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (!el) return;
  const cardId = +el.dataset.cardId;
  const idx = board.findIndex(c => c.id === cardId);
  if (idx !== -1) onCardClick(idx, el);
});

// ── Click handler ────────────────────────────────────────────
function onCardClick(idx, el) {
  if (gameOver || busy) return;
  clearHint();

  const alreadyAt = selected.indexOf(idx);
  if (alreadyAt !== -1) {
    selected.splice(alreadyAt, 1);
    el.classList.remove('selected');
    return;
  }

  selected.push(idx);
  el.classList.add('selected');

  if (selected.length === 3) evaluateSelection();
}

// ── Evaluate 3 selected ──────────────────────────────────────
function evaluateSelection() {
  const [i, j, k] = selected;
  const valid = isSet(board[i], board[j], board[k]);
  const els = selected.map(idx => cardElements.get(board[idx].id));

  if (valid) {
    busy = true;
    score++;
    scoreVal.textContent = score;
    els.forEach(el => { el.classList.remove('selected'); el.classList.add('valid-set', 'locked'); });
    showToast('SET! +1', '#32D74B');

    setTimeout(() => {
      const toReplace = selected.slice();
      selected = [];
      replaceCards(toReplace);
      busy = false;
      updateDeckCount();
      updateFooter();
      checkGameOver();
    }, 560);

  } else {
    misses++;
    els.forEach(el => { el.classList.remove('selected'); el.classList.add('invalid-set'); });
    showToast('Not a SET', '#FF453A');
    setTimeout(() => {
      els.forEach(el => el.classList.remove('invalid-set'));
      selected = [];
    }, 500);
  }
}

// ── Replace matched cards ────────────────────────────────────
function replaceCards(indices) {
  indices.sort((a, b) => a - b);

  if (board.length <= 12 && deck.length >= 3) {
    const newCards = dealFrom(3);
    indices.forEach((bi, ri) => {
      const oldCard = board[bi];
      const newCard = newCards[ri];

      const oldEl = cardElements.get(oldCard.id);
      cardElements.delete(oldCard.id);

      const newEl = createCardEl(newCard);
      newEl.dataset.cardId = newCard.id;
      cardElements.set(newCard.id, newEl);
      board[bi] = newCard;

      oldEl.replaceWith(newEl);
    });

  } else {
    indices.forEach(bi => {
      const oldEl = cardElements.get(board[bi].id);
      cardElements.delete(board[bi].id);
      oldEl.remove();
      board[bi] = null;
    });
    board = board.filter(c => c !== null);

    while (board.length < 12 && deck.length > 0) {
      const newCard = deck.shift();
      board.push(newCard);
      const newEl = createCardEl(newCard);
      cardElements.set(newCard.id, newEl);
      boardEl.appendChild(newEl);
    }
  }
}

// ── Hint ─────────────────────────────────────────────────────
function doHint() {
  if (gameOver || busy) return;
  const combo = findSet(board);
  if (!combo) { showToast('No SETs — deal more!', '#FFD60A'); return; }

  clearHint();
  hints++;
  hintsVal.textContent = hints;
  showToast('Hint used', '#FFD60A');

  hintIndices = combo;
  combo.forEach(idx => {
    const el = cardElements.get(board[idx].id);
    if (el) el.classList.add('hint');
  });

  hintTO = setTimeout(clearHint, 3000);
}

function clearHint() {
  hintIndices.forEach(idx => {
    const card = board[idx];
    if (!card) return;
    const el = cardElements.get(card.id);
    if (el) el.classList.remove('hint');
  });
  hintIndices = [];
  if (hintTO) { clearTimeout(hintTO); hintTO = null; }
}

// ── Deal 3 ───────────────────────────────────────────────────
function dealThree() {
  if (gameOver || busy) return;
  if (findSet(board)) { showToast('A SET exists — find it!', '#64D2FF'); return; }
  if (deck.length < 3) { showToast('No cards left!', '#FF453A'); return; }

  const newCards = dealFrom(3);
  newCards.forEach(card => {
    board.push(card);
    const el = createCardEl(card);
    cardElements.set(card.id, el);
    boardEl.appendChild(el);
  });

  updateDeckCount();
  updateFooter();
  noSetNotice.textContent = '';
}

// ── Game over check ──────────────────────────────────────────
function checkGameOver() {
  const hasSet = findSet(board);
  if (board.length === 0 || (deck.length === 0 && !hasSet)) {
    stopTimer();
    gameOver = true;
    btnHint.disabled = true;
    btnDeal.disabled = true;

    const totalAttempts = score + misses;
    const accPct = totalAttempts > 0 ? Math.round(score / totalAttempts * 100) : 100;
    const spm    = timerSecs > 0 ? (score / (timerSecs / 60)) : score;

    let stars;
    if      (spm >= 5  && accPct >= 90 && hints === 0) stars = 5;
    else if (spm >= 3.5 && accPct >= 75)               stars = 4;
    else if (spm >= 2  && accPct >= 60)                stars = 3;
    else if (score >= 5)                                stars = 2;
    else                                                stars = 1;

    const RATINGS = [
      null,
      { emoji: '🌱', label: 'Keep practicing' },
      { emoji: '👍', label: 'Good start' },
      { emoji: '🎯', label: 'Sharp' },
      { emoji: '⚡', label: 'Expert' },
      { emoji: '🏆', label: 'Perfect' },
    ];
    const { emoji, label } = RATINGS[stars];

    document.getElementById('modalEmoji').textContent   = emoji;
    document.getElementById('modalTitle').textContent   = label;
    document.getElementById('modalRating').textContent  = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    document.getElementById('modalScore').textContent   = score;
    document.getElementById('modalTime').textContent    = fmt(timerSecs);
    document.getElementById('modalHints').textContent   = hints;

    const accEl = document.getElementById('modalAccuracy');
    accEl.textContent = `${accPct}%`;
    accEl.className = 'report-val ' + (accPct === 100 ? 'great' : accPct >= 75 ? 'good' : 'warn');

    const spmEl = document.getElementById('modalSpeed');
    spmEl.textContent = `${spm.toFixed(1)} SETs / min`;
    spmEl.className = 'report-val ' + (spm >= 4 ? 'great' : spm >= 2 ? 'good' : '');

    const missEl = document.getElementById('modalMisses');
    missEl.textContent = misses === 0 ? 'None ✓' : misses;
    missEl.className = 'report-val ' + (misses === 0 ? 'great' : misses <= 3 ? 'good' : 'warn');

    setTimeout(showModal, 400);
    return;
  }
  noSetNotice.textContent = (!hasSet && deck.length > 0)
    ? 'No SET on board — deal 3 more' : '';
}

// ── Helpers ──────────────────────────────────────────────────
function updateDeckCount() { deckVal.textContent = deck.length; }

function updateFooter() {
  const hasSet = !!findSet(board);
  btnHint.disabled = gameOver;
  btnDeal.disabled = gameOver || hasSet || deck.length < 3;
  noSetNotice.textContent = (!hasSet && deck.length > 0 && board.length > 0)
    ? 'No SET on board — deal 3 more' : '';
}

function showModal() { modalBackdrop.classList.add('show'); }
function hideModal() { modalBackdrop.classList.remove('show'); }

function showToast(msg, color) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  if (color) t.style.borderColor = color + '55';
  toastWrap.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 1800);
}

// ── SVG ──────────────────────────────────────────────────────
let patId = 0;

function buildCardSVG(card) {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const N   = card.number;
  const SH  = 60, GAP = 10;
  svg.setAttribute('viewBox', `0 0 100 ${N*SH+(N-1)*GAP}`);
  svg.setAttribute('width',  '90');
  svg.setAttribute('height', '108');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const { shape, color, shading } = card;
  const defs = document.createElementNS(ns, 'defs');
  let hasDefs = false;

  for (let i = 0; i < N; i++) {
    const yOff = i * (SH + GAP);
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(0,${yOff})`);

    if (shading === 'striped') {
      hasDefs = true;
      const uid = `sp${patId++}`;
      const cid = uid+'c', pid = uid+'p';

      const clip = document.createElementNS(ns, 'clipPath');
      clip.setAttribute('id', cid);
      clip.appendChild(shapeEl(ns, shape, 'black', 'none', 0));
      defs.appendChild(clip);

      const pat = document.createElementNS(ns, 'pattern');
      pat.setAttribute('id', pid);
      pat.setAttribute('x','0'); pat.setAttribute('y','0');
      pat.setAttribute('width','8'); pat.setAttribute('height','8');
      pat.setAttribute('patternUnits','userSpaceOnUse');
      const ln = document.createElementNS(ns, 'line');
      ln.setAttribute('x1','0'); ln.setAttribute('y1','4');
      ln.setAttribute('x2','8'); ln.setAttribute('y2','4');
      ln.setAttribute('stroke', color); ln.setAttribute('stroke-width','2');
      pat.appendChild(ln);
      defs.appendChild(pat);

      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x','0'); r.setAttribute('y','0');
      r.setAttribute('width','100'); r.setAttribute('height','60');
      r.setAttribute('fill',`url(#${pid})`);
      r.setAttribute('clip-path',`url(#${cid})`);
      g.appendChild(r);
      g.appendChild(shapeEl(ns, shape, 'none', color, 4));

    } else {
      g.appendChild(shapeEl(ns, shape,
        shading === 'solid' ? color : 'none',
        shading === 'solid' ? 'none' : color,
        shading === 'solid' ? 0 : 4));
    }
    svg.appendChild(g);
  }
  if (hasDefs) svg.insertBefore(defs, svg.firstChild);
  return svg;
}

function shapeEl(ns, shape, fill, stroke, sw) {
  let el;
  if (shape === 'oval') {
    el = document.createElementNS(ns, 'ellipse');
    el.setAttribute('cx','50'); el.setAttribute('cy','30');
    el.setAttribute('rx','44'); el.setAttribute('ry','24');
  } else if (shape === 'diamond') {
    el = document.createElementNS(ns, 'polygon');
    el.setAttribute('points','50,4 94,30 50,56 6,30');
  } else {
    el = document.createElementNS(ns, 'path');
    el.setAttribute('d','M 5,20 C 5,5 20,5 30,15 C 40,25 60,35 70,25 C 80,15 95,15 95,25 L 95,40 C 95,55 80,55 70,45 C 60,35 40,25 30,35 C 20,45 5,45 5,40 Z');
  }
  el.setAttribute('fill', fill);
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', sw);
  return el;
}
