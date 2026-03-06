// ── Elements ─────────────────────────────────────────────────
const slotA    = document.getElementById('slot-a');
const slotB    = document.getElementById('slot-b');
const frontA   = document.getElementById('front-a');
const frontB   = document.getElementById('front-b');
const mainBtn  = document.getElementById('main-btn');
const resetBtn = document.getElementById('reset-btn');
const subtitle = document.getElementById('subtitle');

// ── State ─────────────────────────────────────────────────────
// 'idle' | 'shuffling' | 'picking' | 'done'
let gameState = 'idle';

// Which result lives in which slot: { a: 'first'|'second', b: 'first'|'second' }
let slotResults = {};

// ── Init ──────────────────────────────────────────────────────
mainBtn.addEventListener('click', startShuffle);
resetBtn.addEventListener('click', reset);
initCards();

// ── Helpers ───────────────────────────────────────────────────
function getCardInSlot(slotEl) {
  return slotEl.querySelector('.card');
}

function buildCardFront(el, result) {
  if (result === 'first') {
    el.className = 'card-front result-first';
    el.innerHTML = `
      <div class="result-emoji">&#x1F451;</div>
      <div class="result-label">You Go</div>
      <div class="result-main">FIRST</div>
    `;
  } else {
    el.className = 'card-front result-second';
    el.innerHTML = `
      <div class="result-emoji">&#x1F6E1;&#xFE0F;</div>
      <div class="result-label">You Go</div>
      <div class="result-main">SECOND</div>
    `;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Show cards face-up on load / reset ────────────────────────
function initCards() {
  gameState = 'idle';

  const cardA = document.getElementById('card-a');
  const cardB = document.getElementById('card-b');

  // Restore original DOM positions
  slotA.appendChild(cardA);
  slotB.appendChild(cardB);

  // Cancel any leftover animations
  [cardA, cardB].forEach(card => {
    card.getAnimations().forEach(a => a.cancel());
    card.classList.remove('pickable', 'reveal-first', 'reveal-second');
  });

  // Fixed starting assignment — shuffle provides the randomness
  slotResults = { a: 'first', b: 'second' };
  buildCardFront(frontA, 'first');
  buildCardFront(frontB, 'second');

  // Show face-up so players can memorize
  cardA.classList.add('flipped');
  cardB.classList.add('flipped');

  subtitle.textContent = 'Memorize the cards, then shuffle!';
  subtitle.classList.remove('shuffling');
  mainBtn.disabled = false;
  mainBtn.style.display = '';
  resetBtn.style.display = 'none';
}

// ── Swap animation ────────────────────────────────────────────
async function animateSwap(fast) {
  const cardInA = getCardInSlot(slotA);
  const cardInB = getCardInSlot(slotB);

  const rectA = slotA.getBoundingClientRect();
  const rectB = slotB.getBoundingClientRect();
  const dx = rectB.left - rectA.left;
  const duration = fast ? 220 : 320;

  // One card arcs over (up), other arcs under (down)
  cardInA.style.zIndex = '2';
  cardInB.style.zIndex = '1';

  const animA = cardInA.animate([
    { transform: 'translate(0px, 0px)', offset: 0 },
    { transform: `translate(${dx * 0.5}px, -36px)`, offset: 0.5 },
    { transform: `translate(${dx}px, 0px)`, offset: 1 },
  ], { duration, easing: 'ease-in-out', fill: 'forwards' });

  const animB = cardInB.animate([
    { transform: 'translate(0px, 0px)', offset: 0 },
    { transform: `translate(${-dx * 0.5}px, 20px)`, offset: 0.5 },
    { transform: `translate(${-dx}px, 0px)`, offset: 1 },
  ], { duration, easing: 'ease-in-out', fill: 'forwards' });

  await Promise.all([animA.finished, animB.finished]);

  // Commit swap to DOM
  animA.cancel();
  animB.cancel();
  cardInA.style.zIndex = '';
  cardInB.style.zIndex = '';
  slotA.appendChild(cardInB);
  slotB.appendChild(cardInA);

  // Slot results follow the cards
  const tmp = slotResults.a;
  slotResults.a = slotResults.b;
  slotResults.b = tmp;
}

// ── Shuffle ───────────────────────────────────────────────────
async function startShuffle() {
  if (gameState !== 'idle') return;
  gameState = 'shuffling';

  mainBtn.disabled = true;
  subtitle.textContent = 'Watch carefully...';

  // Flip both cards face-down first so user watches them hide
  const cardInA = getCardInSlot(slotA);
  const cardInB = getCardInSlot(slotB);
  cardInA.classList.remove('flipped');
  cardInB.classList.remove('flipped');

  // Wait for flip-down animation to complete
  await sleep(700);

  subtitle.textContent = 'Shuffling...';
  subtitle.classList.add('shuffling');

  // Shuffle: 5–8 swaps, starting slow then speeding up
  const numSwaps = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numSwaps; i++) {
    const fast = i >= Math.floor(numSwaps * 0.5);
    await animateSwap(fast);
    await sleep(fast ? 40 : 80);
  }

  // Rebuild fronts based on where cards landed after swaps
  const finalCardInA = getCardInSlot(slotA);
  const finalCardInB = getCardInSlot(slotB);
  buildCardFront(finalCardInA.querySelector('.card-front'), slotResults.a);
  buildCardFront(finalCardInB.querySelector('.card-front'), slotResults.b);

  subtitle.classList.remove('shuffling');
  subtitle.textContent = 'Pick a card!';
  gameState = 'picking';

  finalCardInA.classList.add('pickable');
  finalCardInB.classList.add('pickable');
  finalCardInA.addEventListener('click', onPickCard, { once: true });
  finalCardInB.addEventListener('click', onPickCard, { once: true });
}

// ── Pick ──────────────────────────────────────────────────────
async function onPickCard(e) {
  if (gameState !== 'picking') return;
  gameState = 'done';

  const pickedCard = e.currentTarget;
  const pickedSlot = pickedCard.closest('.card-slot');
  const otherCard  = getCardInSlot(pickedSlot === slotA ? slotB : slotA);

  // Remove pickable from both and cancel any lingering swap animations
  [pickedCard, otherCard].forEach(card => {
    card.classList.remove('pickable');
    card.getAnimations().forEach(a => a.cancel());
  });
  otherCard.removeEventListener('click', onPickCard);

  const pickedResult = pickedSlot === slotA ? slotResults.a : slotResults.b;

  // Force reflow so the browser clears the previous transform before flipping
  void pickedCard.offsetHeight;

  // Flip picked card face-up, wait for flip to fully complete (650ms transition)
  pickedCard.classList.add('flipped');
  await sleep(700);

  // Apply glow class after flip is done (filter/box-shadow safe now)
  pickedCard.classList.add(`reveal-${pickedResult}`);

  // Update subtitle
  if (pickedResult === 'first') {
    subtitle.textContent = '🎉 You go FIRST this game!';
  } else {
    subtitle.textContent = '🤝 You go SECOND this game!';
  }

  // Flip other card after a delay
  await sleep(700);
  otherCard.classList.add('flipped');

  await sleep(400);
  mainBtn.style.display = 'none';
  resetBtn.style.display = 'block';
}

// ── Reset ─────────────────────────────────────────────────────
function reset() {
  initCards();
}
