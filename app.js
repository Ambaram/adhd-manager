// ===== STATE =====
const STATE_KEY = 'focusflow_state';

const defaultState = () => ({
  dumpItems: [],
  focusSlots: [null, null, null],
  subtasks: {},
  wins: [],
  distractions: [],
  focusSessions: 0,
  streak: 0,
  lastActiveDate: null,
  theme: 'light',
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== THEME =====
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveState();
});

applyTheme();

// ===== GREETING =====
function updateGreeting() {
  const hour = new Date().getHours();
  let timeOfDay, emoji;
  if (hour < 12) { timeOfDay = 'morning'; emoji = '☀️'; }
  else if (hour < 17) { timeOfDay = 'afternoon'; emoji = '🌤️'; }
  else if (hour < 21) { timeOfDay = 'evening'; emoji = '🌅'; }
  else { timeOfDay = 'night'; emoji = '🌙'; }

  const nudges = [
    "One thing at a time.",
    "Start small. Start now.",
    "Progress, not perfection.",
    "You're doing better than you think.",
    "Just the next tiny step.",
    "Be kind to your brain today.",
    "Momentum starts with one move.",
  ];
  const nudge = nudges[Math.floor(Math.random() * nudges.length)];
  const el = document.getElementById('greeting');
  el.innerHTML = `Good ${timeOfDay} ${emoji}<span class="time-label">${nudge}</span>`;
}
updateGreeting();

// ===== TABS =====
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ===== STREAK =====
function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastActiveDate === today) return;

  if (state.lastActiveDate) {
    const last = new Date(state.lastActiveDate);
    const diff = Math.floor((new Date(today) - last) / 86400000);
    if (diff === 1) {
      state.streak++;
    } else if (diff > 1) {
      state.streak = 1;
    }
  } else {
    state.streak = 1;
  }
  state.lastActiveDate = today;
  saveState();
}
updateStreak();

// ===== BRAIN DUMP =====
const dumpInput = document.getElementById('dump-input');
const dumpList = document.getElementById('dump-list');
const dumpEmpty = document.getElementById('dump-empty');

function renderDump() {
  dumpList.innerHTML = '';
  const active = state.dumpItems.filter(i => !i.completed);
  const completed = state.dumpItems.filter(i => i.completed);
  const all = [...active, ...completed];

  dumpEmpty.style.display = all.length === 0 ? 'block' : 'none';

  all.forEach(item => {
    const li = document.createElement('li');
    if (item.completed) li.classList.add('completed');

    const check = document.createElement('button');
    check.className = `item-check${item.completed ? ' checked' : ''}`;
    check.addEventListener('click', () => toggleDumpItem(item.id));

    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = item.text;

    const del = document.createElement('button');
    del.className = 'item-delete';
    del.textContent = '×';
    del.addEventListener('click', () => deleteDumpItem(item.id));

    li.append(check, text, del);
    dumpList.appendChild(li);
  });
}

function addDumpItem(text) {
  if (!text.trim()) return;
  state.dumpItems.push({ id: genId(), text: text.trim(), completed: false });
  saveState();
  renderDump();
}

function toggleDumpItem(id) {
  const item = state.dumpItems.find(i => i.id === id);
  if (!item) return;
  item.completed = !item.completed;

  if (item.completed) {
    const checkEl = dumpList.querySelector(`[data-id="${id}"] .item-check, .item-check.checked`);
    addWin(item.text);
  }

  saveState();
  renderDump();
  renderWins();
}

function deleteDumpItem(id) {
  state.dumpItems = state.dumpItems.filter(i => i.id !== id);
  // Also remove from focus slots
  state.focusSlots = state.focusSlots.map(s => s === id ? null : s);
  saveState();
  renderDump();
  renderFocusSlots();
}

dumpInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addDumpItem(dumpInput.value);
    dumpInput.value = '';
  }
});

document.getElementById('dump-add').addEventListener('click', () => {
  addDumpItem(dumpInput.value);
  dumpInput.value = '';
  dumpInput.focus();
});

renderDump();

// ===== TODAY'S FOCUS =====
const focusSlotsEl = document.getElementById('focus-slots');
const pickerOverlay = document.getElementById('picker-overlay');
const pickerList = document.getElementById('picker-list');
const pickerEmpty = document.getElementById('picker-empty');

let activePickerSlot = null;

function renderFocusSlots() {
  state.focusSlots.forEach((itemId, idx) => {
    const slotContent = focusSlotsEl.querySelector(`.slot-content[data-slot="${idx}"]`);
    if (!slotContent) return;

    if (!itemId) {
      slotContent.className = 'slot-content empty';
      slotContent.setAttribute('data-slot', idx);
      slotContent.innerHTML = '<span class="slot-placeholder">Click to pick a task</span>';
      slotContent.onclick = () => openPicker(idx);
    } else {
      const item = state.dumpItems.find(i => i.id === itemId);
      if (!item) {
        state.focusSlots[idx] = null;
        saveState();
        renderFocusSlots();
        return;
      }

      const isDone = item.completed;
      slotContent.className = `slot-content filled${isDone ? ' done' : ''}`;
      slotContent.setAttribute('data-slot', idx);
      slotContent.innerHTML = `
        <span class="slot-task-text">${escHtml(item.text)}</span>
        <div class="slot-actions">
          ${!isDone ? `<button class="slot-btn expand-btn" title="Break down">▼</button>` : ''}
          ${!isDone ? `<button class="slot-btn complete-btn" title="Complete">✓</button>` : ''}
          <button class="slot-btn remove-btn" title="Remove">×</button>
        </div>
      `;
      slotContent.onclick = null;

      const expandBtn = slotContent.querySelector('.expand-btn');
      if (expandBtn) expandBtn.addEventListener('click', () => showSubtasks(idx));

      const completeBtn = slotContent.querySelector('.complete-btn');
      if (completeBtn) completeBtn.addEventListener('click', () => completeFocusTask(idx));

      const removeBtn = slotContent.querySelector('.remove-btn');
      removeBtn.addEventListener('click', () => removeFocusTask(idx));
    }
  });
}

function openPicker(slotIdx) {
  activePickerSlot = slotIdx;
  const usedIds = state.focusSlots.filter(Boolean);
  const available = state.dumpItems.filter(i => !i.completed && !usedIds.includes(i.id));

  pickerList.innerHTML = '';
  pickerEmpty.style.display = available.length === 0 ? 'block' : 'none';

  available.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.text;
    li.addEventListener('click', () => {
      state.focusSlots[activePickerSlot] = item.id;
      saveState();
      renderFocusSlots();
      closePicker();
    });
    pickerList.appendChild(li);
  });

  pickerOverlay.style.display = 'flex';
}

function closePicker() {
  pickerOverlay.style.display = 'none';
  activePickerSlot = null;
}

document.getElementById('picker-close').addEventListener('click', closePicker);
pickerOverlay.addEventListener('click', e => {
  if (e.target === pickerOverlay) closePicker();
});

function completeFocusTask(idx) {
  const itemId = state.focusSlots[idx];
  if (!itemId) return;
  const item = state.dumpItems.find(i => i.id === itemId);
  if (item) {
    item.completed = true;
    addWin(item.text);
  }
  saveState();
  renderFocusSlots();
  renderDump();
  renderWins();
  fireConfetti();
}

function removeFocusTask(idx) {
  state.focusSlots[idx] = null;
  saveState();
  renderFocusSlots();
  hideSubtasks();
}

// ===== SUBTASKS =====
const subtasksArea = document.getElementById('subtasks-area');
const subtaskInput = document.getElementById('subtask-input');
const subtaskList = document.getElementById('subtask-list');
const subtaskParentTitle = document.getElementById('subtask-parent-title');

let activeSubtaskParent = null;

function showSubtasks(slotIdx) {
  const itemId = state.focusSlots[slotIdx];
  if (!itemId) return;
  const item = state.dumpItems.find(i => i.id === itemId);
  if (!item) return;

  activeSubtaskParent = itemId;
  subtaskParentTitle.textContent = `Breaking down: ${item.text}`;
  if (!state.subtasks[itemId]) state.subtasks[itemId] = [];
  subtasksArea.style.display = 'block';
  renderSubtasks();
  subtaskInput.focus();
}

function hideSubtasks() {
  subtasksArea.style.display = 'none';
  activeSubtaskParent = null;
}

function renderSubtasks() {
  if (!activeSubtaskParent) return;
  const subs = state.subtasks[activeSubtaskParent] || [];
  subtaskList.innerHTML = '';

  subs.forEach(sub => {
    const li = document.createElement('li');
    if (sub.completed) li.classList.add('completed');

    const check = document.createElement('button');
    check.className = `item-check${sub.completed ? ' checked' : ''}`;
    check.addEventListener('click', () => {
      sub.completed = !sub.completed;
      if (sub.completed) addWin(sub.text);
      saveState();
      renderSubtasks();
      renderWins();
    });

    const text = document.createElement('span');
    text.className = 'item-text';
    text.textContent = sub.text;

    const del = document.createElement('button');
    del.className = 'item-delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.subtasks[activeSubtaskParent] = subs.filter(s => s.id !== sub.id);
      saveState();
      renderSubtasks();
    });

    li.append(check, text, del);
    subtaskList.appendChild(li);
  });
}

subtaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && activeSubtaskParent) {
    addSubtask(subtaskInput.value);
    subtaskInput.value = '';
  }
});

document.getElementById('subtask-add').addEventListener('click', () => {
  if (activeSubtaskParent) {
    addSubtask(subtaskInput.value);
    subtaskInput.value = '';
    subtaskInput.focus();
  }
});

function addSubtask(text) {
  if (!text.trim() || !activeSubtaskParent) return;
  if (!state.subtasks[activeSubtaskParent]) state.subtasks[activeSubtaskParent] = [];
  state.subtasks[activeSubtaskParent].push({ id: genId(), text: text.trim(), completed: false });
  saveState();
  renderSubtasks();
}

renderFocusSlots();

// ===== FOCUS TIMER =====
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerTotal = 25 * 60;
let timerRunning = false;
let isBreak = false;

const timerDisplay = document.getElementById('timer-display');
const ringProgress = document.getElementById('ring-progress');
const timerStartBtn = document.getElementById('timer-start');
const timerResetBtn = document.getElementById('timer-reset');
const distractionArea = document.getElementById('distraction-area');
const distractionInput = document.getElementById('distraction-input');
const distractionList = document.getElementById('distraction-list');

const CIRCUMFERENCE = 2 * Math.PI * 90;
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = 0;

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const label = isBreak ? 'Break Time' : (timerRunning ? 'Focusing...' : '');
  timerDisplay.innerHTML = `${timeStr}${label ? `<span class="timer-label">${label}</span>` : ''}`;

  const progress = 1 - (timerSeconds / timerTotal);
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  if (isBreak) {
    ringProgress.classList.add('break-mode');
  } else {
    ringProgress.classList.remove('break-mode');
  }
}

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    if (timerRunning) return;
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timerSeconds = parseInt(btn.dataset.minutes) * 60;
    timerTotal = timerSeconds;
    isBreak = false;
    updateTimerDisplay();
  });
});

timerStartBtn.addEventListener('click', () => {
  if (timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

timerResetBtn.addEventListener('click', resetTimer);

function startTimer() {
  timerRunning = true;
  timerStartBtn.textContent = isBreak ? 'Pause Break' : 'Pause';
  timerResetBtn.style.display = 'inline-flex';
  distractionArea.style.display = isBreak ? 'none' : 'block';

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;

      if (!isBreak) {
        state.focusSessions++;
        addWin(`Focus session completed (${timerTotal / 60} min)`);
        saveState();
        renderWins();
        fireConfetti();

        // Move parked distractions to brain dump
        state.distractions.forEach(d => {
          state.dumpItems.push({ id: genId(), text: d.text, completed: false });
        });
        state.distractions = [];
        saveState();
        renderDump();
        renderDistractions();

        // Start break
        isBreak = true;
        timerSeconds = 5 * 60;
        timerTotal = 5 * 60;
        updateTimerDisplay();
        timerStartBtn.textContent = 'Start Break';
        distractionArea.style.display = 'none';
        showNotification('Focus session done! Time for a break.');
      } else {
        isBreak = false;
        const activePreset = document.querySelector('.preset.active');
        timerSeconds = parseInt(activePreset.dataset.minutes) * 60;
        timerTotal = timerSeconds;
        updateTimerDisplay();
        timerStartBtn.textContent = 'Start Focus';
        timerResetBtn.style.display = 'none';
        showNotification('Break over! Ready to focus again?');
      }
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerStartBtn.textContent = isBreak ? 'Resume Break' : 'Resume';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  isBreak = false;
  const activePreset = document.querySelector('.preset.active');
  timerSeconds = parseInt(activePreset.dataset.minutes) * 60;
  timerTotal = timerSeconds;
  updateTimerDisplay();
  timerStartBtn.textContent = 'Start Focus';
  timerResetBtn.style.display = 'none';
  distractionArea.style.display = 'none';
}

updateTimerDisplay();

// ===== DISTRACTIONS =====
function renderDistractions() {
  distractionList.innerHTML = '';
  state.distractions.forEach(d => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = d.text;
    const del = document.createElement('button');
    del.className = 'item-delete';
    del.textContent = '×';
    del.style.opacity = '1';
    del.addEventListener('click', () => {
      state.distractions = state.distractions.filter(x => x.id !== d.id);
      saveState();
      renderDistractions();
    });
    li.append(text, del);
    distractionList.appendChild(li);
  });
}

distractionInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addDistraction(distractionInput.value);
    distractionInput.value = '';
  }
});

document.getElementById('distraction-add').addEventListener('click', () => {
  addDistraction(distractionInput.value);
  distractionInput.value = '';
  distractionInput.focus();
});

function addDistraction(text) {
  if (!text.trim()) return;
  state.distractions.push({ id: genId(), text: text.trim() });
  saveState();
  renderDistractions();
}

renderDistractions();

// ===== WINS =====
const winsList = document.getElementById('wins-list');
const winsEmpty = document.getElementById('wins-empty');

function addWin(text) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.wins.push({ id: genId(), text, time, date: now.toDateString() });
  updateStreak();
  saveState();
}

function renderWins() {
  const today = new Date().toDateString();
  const todayWins = state.wins.filter(w => w.date === today);

  winsList.innerHTML = '';
  winsEmpty.style.display = todayWins.length === 0 ? 'block' : 'none';

  todayWins.forEach(win => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escHtml(win.text)}</span><span class="win-time">${win.time}</span>`;
    winsList.appendChild(li);
  });

  const tasksCompleted = state.dumpItems.filter(i => i.completed).length;
  let allSubtasksDone = 0;
  Object.values(state.subtasks).forEach(subs => {
    allSubtasksDone += subs.filter(s => s.completed).length;
  });

  document.getElementById('stat-tasks').textContent = tasksCompleted + allSubtasksDone;
  document.getElementById('stat-focus').textContent = state.focusSessions;
  document.getElementById('stat-streak').textContent = state.streak;
}

renderWins();

document.getElementById('clear-day').addEventListener('click', () => {
  if (!confirm('Start a fresh day? This clears completed tasks and today\'s wins, but keeps your brain dump.')) return;
  state.dumpItems = state.dumpItems.filter(i => !i.completed);
  state.focusSlots = [null, null, null];
  state.subtasks = {};
  state.wins = [];
  state.distractions = [];
  state.focusSessions = 0;
  saveState();
  renderDump();
  renderFocusSlots();
  renderWins();
  hideSubtasks();
});

// ===== NOTIFICATIONS =====
function showNotification(text) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('FocusFlow', { body: text, icon: '🧠' });
  }
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ===== CONFETTI =====
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiAnimating = false;

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function fireConfetti() {
  const colors = ['#6c63ff', '#ff6b6b', '#34c759', '#ff9f43', '#ffd700', '#00cec9'];
  confettiParticles = [];

  for (let i = 0; i < 80; i++) {
    confettiParticles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -18 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.4 + Math.random() * 0.2,
      opacity: 1,
    });
  }

  if (!confettiAnimating) {
    confettiAnimating = true;
    animateConfetti();
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = false;

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.vy += p.gravity;
    p.y += p.vy;
    p.rotation += p.rotSpeed;
    p.opacity -= 0.012;
    p.vx *= 0.98;

    if (p.opacity > 0) {
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
  });

  if (alive) {
    requestAnimationFrame(animateConfetti);
  } else {
    confettiAnimating = false;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

// ===== UTILS =====
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;

  if (e.key === '1') switchTab('dump');
  if (e.key === '2') switchTab('today');
  if (e.key === '3') switchTab('timer');
  if (e.key === '4') switchTab('wins');
  if (e.key === ' ' && document.querySelector('.tab[data-tab="timer"]').classList.contains('active')) {
    e.preventDefault();
    timerRunning ? pauseTimer() : startTimer();
  }
});

function switchTab(name) {
  tabs.forEach(t => t.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
}

// ===== PWA INSTALL PROMPT =====
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;

  if (localStorage.getItem('focusflow_install_dismissed')) return;

  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <span class="install-banner-text">Install FocusFlow for quick access</span>
    <button class="btn-install">Install</button>
    <button class="btn-dismiss">&times;</button>
  `;

  document.body.appendChild(banner);

  banner.querySelector('.btn-install').addEventListener('click', async () => {
    banner.remove();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });

  banner.querySelector('.btn-dismiss').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('focusflow_install_dismissed', '1');
  });
});

// Handle URL hash for shortcuts
const hash = window.location.hash.replace('#', '');
if (['dump', 'today', 'timer', 'wins'].includes(hash)) {
  switchTab(hash);
}
