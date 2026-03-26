// ── Theme ─────────────────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('mood_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
})();

// ── Firebase init ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBBjGR2KaW69kDXfKzlvn1sybkmI9O5Wos",
  authDomain: "laleonlelion.firebaseapp.com",
  projectId: "laleonlelion",
  storageBucket: "laleonlelion.firebasestorage.app",
  messagingSenderId: "283680064257",
  appId: "1:283680064257:web:a81adf3c5353eafebe1100",
  measurementId: "G-92T6276JVB"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Inside Out emotion config ─────────────────────────────────────
const EMOTIONS = [
  { id: 'joy',           icon: 'sun',          label: 'Joy',         color: '#FFD93D' },
  { id: 'sadness',       icon: 'cloud-rain',   label: 'Sadness',     color: '#4A90D9' },
  { id: 'anger',         icon: 'flame',        label: 'Anger',       color: '#FF4444' },
  { id: 'fear',          icon: 'zap',          label: 'Fear',        color: '#9B59B6' },
  { id: 'disgust',       icon: 'thumbs-down',  label: 'Disgust',     color: '#45B068' },
  { id: 'anxiety',       icon: 'heart-pulse',  label: 'Anxiety',     color: '#FF8C42' },
  { id: 'envy',          icon: 'eye',          label: 'Envy',        color: '#3EB489' },
  { id: 'ennui',         icon: 'minus-circle', label: 'Ennui',       color: '#4169E1' },
  { id: 'embarrassment', icon: 'heart',        label: 'Embarrassed', short: 'Embarr.', color: '#FF69B4' },
  { id: 'nostalgia',     icon: 'clock',        label: 'Nostalgia',   color: '#DDA0DD' },
  { id: 'neutral',       icon: 'minus',        label: 'Neutral',     color: '#8E8E93' },
];
const EMOTION_MAP = Object.fromEntries(EMOTIONS.map(e => [e.id, e]));

// ── State ─────────────────────────────────────────────────────────
let currentUser     = null;
let entriesCache    = [];
let selectedEmotion = null;
let selectedTags    = new Set();
let editingId       = null;
let logDate         = new Date(); // date currently selected in the log tab

// ── Firestore helpers ─────────────────────────────────────────────
function entriesRef() {
  return db.collection('users').doc(currentUser.uid).collection('entries');
}

async function loadEntriesFromFirestore() {
  const snap = await entriesRef()
    .orderBy('timestamp', 'desc')
    .limit(200)
    .get();
  entriesCache = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      emotion: data.emotion,
      tags: data.tags || [],
      note: data.note || '',
      timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
    };
  });
}

async function addEntryToFirestore(entry) {
  const { id, ...data } = entry;
  data.timestamp = firebase.firestore.Timestamp.fromDate(new Date(data.timestamp));
  const ref = await entriesRef().add(data);
  entriesCache.unshift({ id: ref.id, ...entry });
}

async function updateEntryInFirestore(id, updates) {
  await entriesRef().doc(id).update(updates);
  const idx = entriesCache.findIndex(e => e.id === id);
  if (idx !== -1) entriesCache[idx] = { ...entriesCache[idx], ...updates };
}

// ── Auth state ────────────────────────────────────────────────────
function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  el.classList.add('hide');
  el.addEventListener('animationend', () => el.style.display = 'none', { once: true });
}

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    document.getElementById('auth-overlay').style.display = 'none';
    document.querySelector('.app').style.visibility = 'visible';
    const avatar = document.getElementById('user-avatar');
    if (user.photoURL) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
    else { avatar.style.display = 'none'; }
    await loadEntriesFromFirestore();
    checkTodayEntry();
    hideLoadingScreen();
  } else {
    currentUser = null;
    entriesCache = [];
    document.getElementById('auth-overlay').style.display = 'flex';
    document.querySelector('.app').style.visibility = 'hidden';
    hideLoadingScreen();
  }
});

// ── Google Sign-In / Sign-Out ─────────────────────────────────────
document.getElementById('google-signin-btn').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => console.error('Sign-in error', err));
});
document.getElementById('signout-btn').addEventListener('click', () => auth.signOut());

// ── Tab switching ─────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll(`.tab[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'history') renderHistory();
    if (tab === 'stats')   renderStats();
  });
});

// ── Log tab ───────────────────────────────────────────────────────
function formatDateLabel(d) {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
function toDateInputValue(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const logDatePicker = document.getElementById('log-date-picker');
if (logDatePicker) {
  logDatePicker.max   = toDateInputValue(new Date());
  logDatePicker.value = toDateInputValue(new Date());
  logDatePicker.addEventListener('change', () => {
    if (!logDatePicker.value) return;
    const today = toDateInputValue(new Date());
    if (logDatePicker.value > today) logDatePicker.value = today;
    const [y, m, d] = logDatePicker.value.split('-').map(Number);
    logDate = new Date(y, m - 1, d);
    document.getElementById('log-date').textContent = formatDateLabel(logDate);
    resetLogForm();
    checkDateEntry(logDate);
  });
}
document.getElementById('log-date').textContent = formatDateLabel(logDate);

// ── Today helpers ─────────────────────────────────────────────────
function startOfDay(d) {
  const c = new Date(d); c.setHours(0,0,0,0); return c;
}
function getEntryForDate(date) {
  const dayStart = startOfDay(date);
  const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
  return entriesCache.find(e => {
    const t = new Date(e.timestamp); return t >= dayStart && t <= dayEnd;
  }) || null;
}
function getTodayEntry() {
  return getEntryForDate(new Date());
}

// ── Icon helper ───────────────────────────────────────────────────
function iconHtml(name, cls = '') {
  return `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
}

// ── Emotion grid ──────────────────────────────────────────────────
const picker = document.getElementById('emotion-picker');
EMOTIONS.forEach(em => {
  const btn = document.createElement('button');
  btn.className = 'emotion-btn';
  btn.dataset.id = em.id;
  btn.innerHTML = `<i data-lucide="${em.icon}" class="emotion-icon" style="color:${em.color}"></i><span class="emotion-name">${em.short || em.label}</span>`;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emotion-btn').forEach(b => {
      b.classList.remove('selected');
      b.style.borderColor = '';
      b.style.background  = '';
    });
    btn.classList.add('selected');
    btn.style.borderColor = em.color;
    btn.style.background  = hexToRgba(em.color, 0.14);
    selectedEmotion = em.id;
    const label = document.getElementById('emotion-label');
    label.textContent = `Feeling ${em.label}`;
    label.style.color = em.color;
    document.getElementById('save-btn').disabled = false;
    setEmotionBg(em.color);
    setSaveBtnEmotion(em.color);
  });
  picker.appendChild(btn);
});

// ── Load entry into form for editing ─────────────────────────────
function loadEntryForEdit(entry, bannerText) {
  editingId = entry.id;
  const em = EMOTION_MAP[entry.emotion];
  document.querySelectorAll('.emotion-btn').forEach(b => {
    b.classList.remove('selected'); b.style.borderColor = ''; b.style.background = '';
  });
  if (em) {
    const btn = picker.querySelector(`[data-id="${entry.emotion}"]`);
    if (btn) {
      btn.classList.add('selected');
      btn.style.borderColor = em.color;
      btn.style.background  = hexToRgba(em.color, 0.14);
    }
    selectedEmotion = entry.emotion;
    const label = document.getElementById('emotion-label');
    label.textContent = `Feeling ${em.label}`;
    label.style.color = em.color;
    setEmotionBg(em.color);
    setSaveBtnEmotion(em.color);
  }
  selectedTags.clear();
  (entry.tags || []).forEach(t => selectedTags.add(t));
  document.querySelectorAll('.tag-chip').forEach(c => {
    c.classList.toggle('selected', selectedTags.has(c.dataset.tag));
  });
  document.getElementById('note-input').value = entry.note || '';
  document.getElementById('save-btn').disabled = false;
  document.getElementById('save-btn').textContent = 'Update Entry';
  const banner = document.getElementById('log-banner');
  banner.style.display = 'flex';
  banner.innerHTML = `<span class="banner-icon">✏️</span> ${bannerText}`;
}

// ── Lucide + theme init ───────────────────────────────────────────
lucide.createIcons();

function applyThemeIcon() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.getElementById('theme-icon').dataset.lucide = isDark ? 'sun' : 'moon';
  lucide.createIcons();
}
applyThemeIcon();

document.getElementById('theme-toggle').addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem('mood_theme', next);
  applyThemeIcon();
});

// ── Reset log form ────────────────────────────────────────────────
function resetLogForm() {
  editingId = null;
  selectedEmotion = null;
  selectedTags.clear();
  bgLayers.forEach(l => { l.style.opacity = '0'; });
  document.querySelectorAll('.emotion-btn').forEach(b => {
    b.classList.remove('selected'); b.style.borderColor = ''; b.style.background = '';
  });
  document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('note-input').value = '';
  document.getElementById('emotion-label').textContent = 'Pick an emotion';
  document.getElementById('emotion-label').style.color = '';
  document.getElementById('save-btn').disabled = true;
  document.getElementById('save-btn').textContent = 'Save Entry';
  setSaveBtnEmotion(null);
  document.getElementById('log-banner').style.display = 'none';
}

// ── Check entry for selected date ─────────────────────────────────
function checkDateEntry(date) {
  const existing = getEntryForDate(date);
  if (existing) {
    const isToday = startOfDay(date).getTime() === startOfDay(new Date()).getTime();
    const label   = isToday
      ? "You've already logged today"
      : `You've already logged ${formatDateLabel(date)} — editing your entry`;
    loadEntryForEdit(existing, label);
  }
}

function checkTodayEntry() {
  checkDateEntry(logDate);
}

// ── Hex → rgba ────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Emotion background gradient cross-fade ────────────────────────
const bgLayers = [
  document.getElementById('bg-emotion-a'),
  document.getElementById('bg-emotion-b'),
];
let bgActive = 0;

function setEmotionBg(color) {
  const next     = 1 - bgActive;
  const incoming = bgLayers[next];
  const outgoing = bgLayers[bgActive];
  incoming.style.background =
    `radial-gradient(ellipse 100% 70% at 50% 0%, ${hexToRgba(color, 0.28)} 0%, transparent 65%),` +
    `radial-gradient(ellipse 70% 50% at 90% 100%, ${hexToRgba(color, 0.14)} 0%, transparent 60%)`;
  incoming.style.opacity = '1';
  outgoing.style.opacity  = '0';
  bgActive = next;
}

function setSaveBtnEmotion(color) {
  const btn = document.getElementById('save-btn');
  if (color) {
    btn.style.background = `linear-gradient(135deg, ${color} 0%, ${hexToRgba(color, 0.75)} 100%)`;
    btn.style.color = '#1a0e00';
    btn.style.boxShadow = `0 4px 20px ${hexToRgba(color, 0.45)}`;
    btn.style.textShadow = '';
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.boxShadow = '';
    btn.style.textShadow = '';
  }
}

// ── Tag chips ─────────────────────────────────────────────────────
document.querySelectorAll('.tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const tag = chip.dataset.tag;
    if (selectedTags.has(tag)) { selectedTags.delete(tag); chip.classList.remove('selected'); }
    else                       { selectedTags.add(tag);    chip.classList.add('selected'); }
  });
});

// ── Save / Update ─────────────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', async () => {
  if (!selectedEmotion || !currentUser) return;
  const note     = document.getElementById('note-input').value.trim();
  const wasEdit  = !!editingId;

  if (editingId) {
    await updateEntryInFirestore(editingId, {
      emotion: selectedEmotion, tags: [...selectedTags], note,
      timestamp: new Date().toISOString()
    });
  } else {
    const alreadyDate = getEntryForDate(logDate);
    if (alreadyDate) {
      const isToday = startOfDay(logDate).getTime() === startOfDay(new Date()).getTime();
      const label   = isToday
        ? "You've already logged today"
        : `You've already logged ${formatDateLabel(logDate)} — editing your entry`;
      loadEntryForEdit(alreadyDate, label);
      return;
    }
    // Use noon of logDate for past entries, current time for today
    const isToday = startOfDay(logDate).getTime() === startOfDay(new Date()).getTime();
    const ts      = isToday ? new Date() : new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate(), 12, 0, 0);
    await addEntryToFirestore({
      emotion: selectedEmotion, tags: [...selectedTags], note,
      timestamp: ts.toISOString(),
    });
  }

  resetLogForm();
  checkDateEntry(logDate);

  const msg = document.getElementById('save-msg');
  msg.textContent = wasEdit ? '✓ Entry updated' : '✓ Entry saved';
  setTimeout(() => { msg.textContent = ''; }, 2500);
});

// ── History tab ───────────────────────────────────────────────────
let historyView      = 'week';
let currentMonthDate = new Date();
let currentYearDate  = new Date();

document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    historyView = btn.dataset.view;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === historyView));
    document.querySelectorAll('.history-view').forEach(el => el.style.display = 'none');
    document.getElementById(`view-${historyView}`).style.display = '';
    if (historyView === 'week')  renderWeekStrip();
    if (historyView === 'month') renderMonthView();
    if (historyView === 'year')  renderYearView();
    lucide.createIcons();
  });
});

document.getElementById('cal-prev').addEventListener('click', () => {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
  renderMonthView();
});
document.getElementById('cal-next').addEventListener('click', () => {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
  renderMonthView();
});
document.getElementById('year-prev').addEventListener('click', () => {
  currentYearDate = new Date(currentYearDate.getFullYear() - 1, 0, 1);
  renderYearView();
});
document.getElementById('year-next').addEventListener('click', () => {
  currentYearDate = new Date(currentYearDate.getFullYear() + 1, 0, 1);
  renderYearView();
});

function renderHistory() {
  if (historyView === 'week')  renderWeekStrip();
  if (historyView === 'month') renderMonthView();
  if (historyView === 'year')  renderYearView();
  renderEntryList();
}

// ── Month calendar view ───────────────────────────────────────────
function renderMonthView() {
  const year  = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-hdr';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDow = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day cal-empty';
    grid.appendChild(e);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStart = new Date(year, month, d, 0, 0, 0, 0);
    const dayEnd   = new Date(year, month, d, 23, 59, 59, 999);
    const dayEntries = entriesCache.filter(e => {
      const t = new Date(e.timestamp); return t >= dayStart && t <= dayEnd;
    });
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isToday ? ' cal-today' : '') + (dayEntries.length ? ' cal-has-entry' : '');

    const num = document.createElement('span');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (dayEntries.length > 0) {
      const freq = {};
      dayEntries.forEach(e => { freq[e.emotion] = (freq[e.emotion] || 0) + 1; });
      const topId = Object.entries(freq).sort((a,b) => b[1]-a[1])[0][0];
      const em = EMOTION_MAP[topId];
      if (em) {
        const icon = document.createElement('div');
        icon.className = 'cal-day-icon';
        icon.innerHTML = `<i data-lucide="${em.icon}" class="cal-icon" style="color:${em.color}"></i>`;
        cell.appendChild(icon);
        cell.style.borderColor = hexToRgba(em.color, 0.4);
      }
    }
    grid.appendChild(cell);
  }
  lucide.createIcons();
}

// ── Year heatmap view ─────────────────────────────────────────────
function renderYearView() {
  const year = currentYearDate.getFullYear();
  document.getElementById('year-title').textContent = String(year);

  const wrap = document.getElementById('year-heatmap');
  wrap.innerHTML = '';

  // Build date → dominant emotion map
  const dayEmotion = {};
  entriesCache.forEach(e => {
    const t = new Date(e.timestamp);
    if (t.getFullYear() !== year) return;
    const key = `${t.getMonth()}-${t.getDate()}`;
    if (!dayEmotion[key]) dayEmotion[key] = {};
    dayEmotion[key][e.emotion] = (dayEmotion[key][e.emotion] || 0) + 1;
  });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Start on the Sunday on or before Jan 1
  const jan1     = new Date(year, 0, 1);
  const startDay = new Date(jan1); startDay.setDate(jan1.getDate() - jan1.getDay());
  const dec31    = new Date(year, 11, 31);
  const endDay   = new Date(dec31); endDay.setDate(dec31.getDate() + (6 - dec31.getDay()));

  const inner = document.createElement('div');
  inner.className = 'heatmap-inner';

  // Day-of-week labels
  const dowCol = document.createElement('div');
  dowCol.className = 'heatmap-dow-col';
  ['S','M','T','W','T','F','S'].forEach(l => {
    const el = document.createElement('div');
    el.className = 'heatmap-dow-lbl';
    el.textContent = l;
    dowCol.appendChild(el);
  });

  const right       = document.createElement('div');
  right.className   = 'heatmap-right';
  const monthRow    = document.createElement('div');
  monthRow.className = 'heatmap-month-row';
  const weeksRow    = document.createElement('div');
  weeksRow.className = 'heatmap-weeks-row';

  const today    = new Date();
  let prevMonth  = -1;
  let d = new Date(startDay);

  while (d <= endDay) {
    const ml = document.createElement('div');
    ml.className = 'hm-month-lbl';

    // Label the week if a new month starts in it
    for (let i = 0; i < 7; i++) {
      const dd = new Date(d); dd.setDate(dd.getDate() + i);
      if (dd.getFullYear() === year && dd.getMonth() !== prevMonth) {
        ml.textContent = monthNames[dd.getMonth()];
        prevMonth = dd.getMonth();
        break;
      }
    }
    monthRow.appendChild(ml);

    const weekCol = document.createElement('div');
    weekCol.className = 'heatmap-week-col';

    for (let dow = 0; dow < 7; dow++) {
      const cell     = document.createElement('div');
      const isInYear = d.getFullYear() === year;
      const isToday  = d.toDateString() === today.toDateString();
      const key      = `${d.getMonth()}-${d.getDate()}`;

      cell.className = 'hm-day' + (isToday ? ' hm-today' : '') + (!isInYear ? ' hm-out' : '');

      if (isInYear && dayEmotion[key]) {
        const topId = Object.entries(dayEmotion[key]).sort((a,b) => b[1]-a[1])[0][0];
        const em    = EMOTION_MAP[topId];
        if (em) {
          cell.style.background  = hexToRgba(em.color, 0.75);
          cell.style.borderColor = em.color;
          cell.title = `${d.toLocaleDateString([],{month:'short',day:'numeric'})} · ${em.label}`;
        }
      }

      weekCol.appendChild(cell);
      d.setDate(d.getDate() + 1);
    }
    weeksRow.appendChild(weekCol);
  }

  right.appendChild(monthRow);
  right.appendChild(weeksRow);
  inner.appendChild(dowCol);
  inner.appendChild(right);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'heatmap-scroll';
  scrollWrap.appendChild(inner);
  wrap.appendChild(scrollWrap);
}

function renderWeekStrip() {
  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';
  const today    = startOfDay(new Date());
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  for (let i = 6; i >= 0; i--) {
    const d    = new Date(today); d.setDate(d.getDate() - i);
    const dEnd = new Date(d); dEnd.setHours(23,59,59,999);

    const dayEntries = entriesCache.filter(e => {
      const t = new Date(e.timestamp); return t >= d && t <= dEnd;
    });

    const cell    = document.createElement('div');
    cell.className = 'day-cell' + (i === 0 ? ' today' : '');

    const dayName = document.createElement('div');
    dayName.className   = 'day-name';
    dayName.textContent = dayNames[d.getDay()];

    const dayNum = document.createElement('div');
    dayNum.className   = 'day-num';
    dayNum.textContent = d.getDate();

    const dayIcon = document.createElement('div');
    dayIcon.className = 'day-emoji';
    if (dayEntries.length > 0) {
      const freq = {};
      dayEntries.forEach(e => { freq[e.emotion] = (freq[e.emotion] || 0) + 1; });
      const top = Object.entries(freq).sort((a,b) => b[1]-a[1])[0][0];
      const em  = EMOTION_MAP[top];
      if (em) {
        dayIcon.innerHTML = iconHtml(em.icon, 'day-icon');
        dayIcon.style.color  = em.color;
        dayIcon.style.filter = `drop-shadow(0 0 4px ${em.color}88)`;
      }
    }

    cell.append(dayName, dayNum, dayIcon);
    strip.appendChild(cell);
  }
  lucide.createIcons();
}

function formatEntryTime(iso) {
  const d         = new Date(iso);
  const today     = startOfDay(new Date());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const entryDay  = startOfDay(d);
  const time      = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (entryDay.getTime() === today.getTime())     return `Today ${time}`;
  if (entryDay.getTime() === yesterday.getTime()) return `Yesterday`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderEntryList() {
  const list  = document.getElementById('entry-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';

  if (entriesCache.length === 0) { empty.classList.add('show'); return; }
  empty.classList.remove('show');

  entriesCache.slice(0, 60).forEach(entry => {
    const em   = EMOTION_MAP[entry.emotion] || EMOTION_MAP['neutral'];
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-emoji" style="color:${em.color}">${iconHtml(em.icon, 'entry-icon')}</div>
      <div class="entry-body">
        <div class="entry-header">
          <span class="entry-mood-label" style="color:${em.color}">${em.label}</span>
          <span class="entry-time">${formatEntryTime(entry.timestamp)}</span>
          <button class="entry-edit-btn" title="Edit entry">✏️</button>
        </div>
        ${entry.tags.length ? `<div class="entry-tags">${entry.tags.map(t=>`<span class="entry-tag">${t}</span>`).join('')}</div>` : ''}
        ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
      </div>
    `;
    card.querySelector('.entry-edit-btn').addEventListener('click', () => {
      const dateStr = formatEntryTime(entry.timestamp).replace(/\d{1,2}:\d{2}\s?(AM|PM)?/i, '').trim();
      loadEntryForEdit(entry, `Editing entry — ${dateStr}`);
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.tab[data-tab="log"]').forEach(b => b.classList.add('active'));
      document.getElementById('tab-log').classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    list.appendChild(card);
  });
  lucide.createIcons();
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Stats tab ─────────────────────────────────────────────────────
function renderStats() {
  const emptyEl = document.getElementById('stats-empty');
  const grid    = document.getElementById('stats-grid');
  grid.innerHTML = '';

  if (entriesCache.length === 0) {
    emptyEl.classList.add('show');
    document.getElementById('chart-wrap').innerHTML = '';
    return;
  }
  emptyEl.classList.remove('show');

  const streak = calcStreak(entriesCache);

  const freq = {};
  entriesCache.forEach(e => { freq[e.emotion] = (freq[e.emotion] || 0) + 1; });
  const sortedFreq = Object.entries(freq).sort((a,b) => b[1]-a[1]);
  const maxFreq = sortedFreq[0][1];
  const topIds = sortedFreq.filter(([,c]) => c === maxFreq).map(([id]) => id);
  const topEm = EMOTION_MAP[topIds[0]];
  const topLabel = topIds.length > 1
    ? topIds.map(id => EMOTION_MAP[id]?.label).filter(Boolean).join(' & ')
    : topEm?.label;

  const today    = startOfDay(new Date());
  const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
  const todayCount = entriesCache.filter(e => {
    const t = new Date(e.timestamp); return t >= today && t <= todayEnd;
  }).length;

  // ── Top Emotion orb card ──
  const topCard = document.createElement('div');
  topCard.className = 'stat-card stat-card-orbs';

  const orbWrap = document.createElement('div');
  orbWrap.className = 'orb-stat-wrap';

  const sortedOrbs = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const maxCount   = sortedOrbs[0][1];
  // Scattered positions [left%, top%] for up to 6 orbs
  const orbPos = [[28,40],[68,28],[18,68],[72,62],[50,16],[50,76]];
  sortedOrbs.slice(0, 6).forEach(([emId, count], i) => {
    const em   = EMOTION_MAP[emId]; if (!em) return;
    const r    = count / maxCount;
    const size = Math.max(14, Math.round(Math.sqrt(r) * 76) - i * 3); // ties get a 3% step down per rank
    const blur = Math.round(8 + r * 18);
    const [lx, ly] = orbPos[i] || [50, 50];
    const orb  = document.createElement('div');
    orb.className = 'orb-stat';
    orb.style.cssText = `width:${size}%;padding-bottom:${size}%;left:${lx}%;top:${ly}%;background:radial-gradient(circle,${em.color},transparent);filter:blur(${blur}px);opacity:${(0.45 + r * 0.2).toFixed(2)};`;
    orbWrap.appendChild(orb);
  });

  const orbText = document.createElement('div');
  orbText.className = 'orb-stat-text';
  orbText.innerHTML = `
    <div class="stat-label">Top Emotion</div>
    <div class="stat-value" style="color:${topEm.color}">${topLabel}</div>
    <div class="stat-sub">most frequent</div>
  `;

  topCard.appendChild(orbWrap);
  topCard.appendChild(orbText);
  grid.appendChild(topCard);

  // ── Remaining stat cards ──
  [
    { label: 'Current Streak', value: `${streak}`, sub: streak === 1 ? 'day' : 'days' },
    { label: 'Total Entries',  value: `${entriesCache.length}`, sub: 'logged' },
    { label: 'Today',          value: `${todayCount}`, sub: todayCount === 1 ? 'entry' : 'entries' },
  ].forEach(s => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    `;
    grid.appendChild(card);
  });

  renderFreqChart(entriesCache);
}

function calcStreak(entries) {
  if (!entries.length) return 0;
  const today = startOfDay(new Date());
  // If today has no entry, start counting from yesterday
  const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
  const hasToday = entries.some(e => { const t = new Date(e.timestamp); return t >= today && t <= todayEnd; });
  let streak = 0;
  let check  = new Date(today);
  if (!hasToday) check.setDate(check.getDate() - 1);
  while (true) {
    const checkEnd = new Date(check); checkEnd.setHours(23,59,59,999);
    const has = entries.some(e => {
      const t = new Date(e.timestamp); return t >= check && t <= checkEnd;
    });
    if (!has) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function renderFreqChart(entries) {
  const since  = new Date(); since.setDate(since.getDate() - 14);
  const recent = entries.filter(e => new Date(e.timestamp) >= since);
  const freq   = {};
  recent.forEach(e => { freq[e.emotion] = (freq[e.emotion] || 0) + 1; });

  const wrap = document.getElementById('chart-wrap');
  wrap.innerHTML = '';

  const sorted = EMOTIONS.filter(em => freq[em.id]).sort((a,b) => (freq[b.id]||0) - (freq[a.id]||0));
  if (sorted.length === 0) {
    wrap.textContent  = 'No data for last 14 days.';
    wrap.style.color  = 'var(--muted)';
    wrap.style.fontSize   = '0.85rem';
    wrap.style.textAlign  = 'center';
    return;
  }

  const max  = Math.max(...Object.values(freq), 1);
  const list = document.createElement('div');
  list.className = 'freq-bar-list';

  sorted.forEach(em => {
    const count = freq[em.id] || 0;
    const pct   = (count / max) * 100;
    const row   = document.createElement('div');
    row.className = 'freq-row';
    row.innerHTML = `
      <span class="freq-emoji" style="color:${em.color}">${iconHtml(em.icon)}</span>
      <span class="freq-label">${em.label}</span>
      <div class="freq-bar-bg">
        <div class="freq-bar-fill" style="width:${pct}%;background:${em.color};"></div>
      </div>
      <span class="freq-count" style="color:${em.color}">${count}</span>
    `;
    list.appendChild(row);
  });

  wrap.appendChild(list);
  lucide.createIcons();
}
