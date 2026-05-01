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
  lastCalm: null,
  moodLog: [],
  reg: {
    breathUses: 0,
    groundUses: 0,
    selfCalmed: 0,
    milestones: [],
  },
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

// ===== GROWTH SYSTEM =====
// Three phases: guided (0-7 uses), growing (8-20 uses), independent (21+)
function getGrowthPhase() {
  const r = state.reg || { breathUses: 0, groundUses: 0, selfCalmed: 0 };
  const total = r.breathUses + r.groundUses + r.selfCalmed;
  if (total >= 21) return 'independent';
  if (total >= 8) return 'growing';
  return 'guided';
}

function getGrowthTotal() {
  const r = state.reg || { breathUses: 0, groundUses: 0, selfCalmed: 0 };
  return r.breathUses + r.groundUses + r.selfCalmed;
}

function trackReg(type) {
  if (!state.reg) state.reg = { breathUses: 0, groundUses: 0, selfCalmed: 0, milestones: [] };
  if (type === 'breath') state.reg.breathUses++;
  if (type === 'ground') state.reg.groundUses++;
  if (type === 'self') state.reg.selfCalmed++;
  checkMilestones();
  saveState();
}

function checkMilestones() {
  const r = state.reg;
  if (!r.milestones) r.milestones = [];
  const total = r.breathUses + r.groundUses + r.selfCalmed;
  const checks = [
    { id: 'first_breath', at: () => r.breathUses >= 1, text: 'First breathing exercise' },
    { id: 'first_ground', at: () => r.groundUses >= 1, text: 'First grounding session' },
    { id: 'five_total', at: () => total >= 5, text: '5 regulation moments' },
    { id: 'first_self', at: () => r.selfCalmed >= 1, text: 'First time self-regulated' },
    { id: 'growing', at: () => total >= 8, text: 'Entered Growing phase' },
    { id: 'three_self', at: () => r.selfCalmed >= 3, text: 'Self-regulated 3 times' },
    { id: 'fifteen', at: () => total >= 15, text: '15 regulation moments' },
    { id: 'independent', at: () => total >= 21, text: 'Reached Independent phase' },
    { id: 'ten_self', at: () => r.selfCalmed >= 10, text: 'Self-regulated 10 times' },
  ];
  checks.forEach(m => {
    if (!r.milestones.includes(m.id) && m.at()) {
      r.milestones.push(m.id);
      addWin('🌱 Milestone: ' + m.text);
    }
  });
}

// ===== CALM LANDING SCREEN =====
const calmLanding = document.getElementById('calm-landing');
const calmBreathLabel = document.getElementById('calm-breath-label');
const calmSkip = document.getElementById('calm-skip');
const moodCheckin = document.getElementById('mood-checkin');

const calmMessagesByPhase = {
  guided: [
    { title: "Take a moment.", sub: "You're safe here. Nothing needs to happen right now." },
    { title: "Pause. Breathe.", sub: "This moment is yours. No rush, no pressure." },
    { title: "Hey, you showed up.", sub: "That already counts. Let's take it slow." },
    { title: "Welcome back.", sub: "Before we begin, let's just breathe together." },
  ],
  growing: [
    { title: "You know the drill.", sub: "One breath to center yourself. You're getting good at this." },
    { title: "Welcome back.", sub: "You've been building real skills. Take a breath if you'd like." },
    { title: "Quick check-in.", sub: "You're learning to read your own signals. That's real progress." },
  ],
  independent: [
    { title: "Hey.", sub: "You already know how to calm yourself. We're just here when you want us." },
    { title: "You've got this.", sub: "You've proven you can regulate on your own. Use us if you'd like." },
    { title: "Welcome back, pro.", sub: "You don't need us to breathe — but we're here anyway." },
  ],
};

function shouldShowCalm() {
  const lastCalm = state.lastCalm;
  if (!lastCalm) return true;
  const phase = getGrowthPhase();
  const cooldownHours = phase === 'guided' ? 4 : phase === 'growing' ? 8 : 24;
  const hours = (Date.now() - lastCalm) / (1000 * 60 * 60);
  return hours >= cooldownHours;
}

function initCalmScreen() {
  if (!shouldShowCalm()) {
    calmLanding.style.display = 'none';
    return;
  }

  const phase = getGrowthPhase();
  const msgs = calmMessagesByPhase[phase];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  document.getElementById('calm-title').textContent = msg.title;
  document.getElementById('calm-subtitle').textContent = msg.sub;

  if (phase === 'independent') {
    calmSkip.textContent = "Let's go";
    calmSkip.style.animationDelay = '0.5s';
  } else if (phase === 'growing') {
    calmSkip.textContent = "I'm centered";
    calmSkip.style.animationDelay = '1s';
  }

  const breathPhrases = ['Breathe in...', 'Hold...', 'Breathe out...', 'Hold...'];
  let breathIdx = 0;
  const breathInterval = setInterval(() => {
    breathIdx = (breathIdx + 1) % breathPhrases.length;
    calmBreathLabel.textContent = breathPhrases[breathIdx];
  }, 2000);

  calmSkip.addEventListener('click', () => {
    clearInterval(breathInterval);
    calmLanding.classList.add('fade-out');
    state.lastCalm = Date.now();
    saveState();
    setTimeout(() => {
      calmLanding.style.display = 'none';
      showMoodCheckin();
    }, 600);
  });
}

initCalmScreen();

// ===== MOOD CHECK-IN =====
const crisisMoods = ['overwhelmed', 'anxious'];

const moodResponses = {
  scattered: "That's just an ADHD brain doing its thing. Let's dump those thoughts — no organizing needed.",
  low: "Low energy is real. One tiny thing today is enough. Be gentle with yourself.",
  okay: "You're here, you showed up. Let's make today work for you.",
  good: "Love that energy! Let's ride this wave.",
};

function showMoodCheckin() {
  moodCheckin.style.display = 'flex';
  const btns = document.querySelectorAll('.mood-btn');
  const response = document.getElementById('mood-response');
  const responseText = document.getElementById('mood-response-text');
  const continueBtn = document.getElementById('mood-continue');
  const groundBtn = document.getElementById('mood-ground');
  const selfRegBtn = document.getElementById('mood-self-reg');

  const phase = getGrowthPhase();
  if (phase !== 'guided') {
    selfRegBtn.style.display = 'flex';
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;

      state.moodLog.push({ mood, timestamp: Date.now(), date: new Date().toDateString() });
      saveState();

      if (crisisMoods.includes(mood)) {
        moodCheckin.style.display = 'none';
        openInstantCalm(mood);
        return;
      }

      btns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      responseText.textContent = moodResponses[mood];
      groundBtn.style.display = 'none';
      response.style.display = 'block';
      document.getElementById('mood-options').style.display = 'none';
      selfRegBtn.style.display = 'none';
    });
  });

  selfRegBtn.addEventListener('click', () => {
    trackReg('self');
    state.moodLog.push({ mood: 'self-regulated', timestamp: Date.now(), date: new Date().toDateString() });
    saveState();

    const selfMessages = [
      "You handled it before you even got here. That's real strength.",
      "Look at you — regulating on your own. You're building something lasting.",
      "You didn't need the app this time. That's the whole point.",
      "The skills you've practiced are becoming second nature.",
    ];
    responseText.textContent = selfMessages[Math.floor(Math.random() * selfMessages.length)];
    groundBtn.style.display = 'none';
    response.style.display = 'block';
    document.getElementById('mood-options').style.display = 'none';
    selfRegBtn.style.display = 'none';
    renderWins();
    renderGrowth();
  });

  continueBtn.addEventListener('click', () => {
    moodCheckin.classList.add('fade-out');
    setTimeout(() => { moodCheckin.style.display = 'none'; }, 500);
  });

  groundBtn.addEventListener('click', () => {
    moodCheckin.style.display = 'none';
    openGroundingExercise();
  });
}

// ===== INSTANT CALM (for overwhelmed/anxious — zero decisions) =====
const instantCalm = document.getElementById('instant-calm');
const instantCalmGuide = document.getElementById('instant-calm-guide');
const instantCalmCounter = document.getElementById('instant-calm-counter');
const instantCalmWhisper = document.getElementById('instant-calm-whisper');
let instantCalmInterval = null;
let instantCalmBreathCount = 0;

const calmWhispersByPhase = {
  guided: {
    overwhelmed: [
      "It's okay. You're safe.",
      "You don't have to solve anything right now.",
      "Just breathe with me.",
    ],
    anxious: [
      "You're here. That's enough.",
      "Let's slow everything down.",
      "Nothing else matters for the next few breaths.",
    ],
  },
  growing: {
    overwhelmed: [
      "You've done this before. You know it works.",
      "This feeling will pass. You've felt it pass before.",
      "You're stronger at this than you were last week.",
    ],
    anxious: [
      "You know the way through this.",
      "Your body remembers how to calm down. Let it.",
      "Each time you do this, it gets a little easier.",
    ],
  },
  independent: {
    overwhelmed: [
      "You already know what to do.",
      "This is just a visit. You don't live here anymore.",
      "You've built this skill. Trust it.",
    ],
    anxious: [
      "You've got a toolkit now. Use what works for you.",
      "This feeling is temporary. You know that from experience.",
      "Your nervous system knows the way back. Let it lead.",
    ],
  },
};

function openInstantCalm(mood) {
  instantCalm.style.display = 'flex';
  instantCalm.classList.remove('fade-out');
  instantCalmBreathCount = 0;

  const phase = getGrowthPhase();
  const whisperSet = calmWhispersByPhase[phase] || calmWhispersByPhase.guided;
  const whispers = whisperSet[mood] || whisperSet.overwhelmed;
  instantCalmWhisper.textContent = whispers[0];
  let whisperIdx = 0;

  const breathPhases = ['Breathe in...', 'Hold gently...', 'Breathe out slowly...', 'Rest...'];
  let phaseIdx = 0;
  instantCalmGuide.textContent = breathPhases[0];

  instantCalmInterval = setInterval(() => {
    phaseIdx = (phaseIdx + 1) % breathPhases.length;
    instantCalmGuide.textContent = breathPhases[phaseIdx];

    if (phaseIdx === 0) {
      instantCalmBreathCount++;
      instantCalmCounter.textContent = instantCalmBreathCount === 1
        ? '1 breath'
        : `${instantCalmBreathCount} breaths`;

      if (instantCalmBreathCount <= whispers.length - 1) {
        whisperIdx++;
        instantCalmWhisper.textContent = whispers[whisperIdx];
      }
    }
  }, 2000);

  document.getElementById('instant-calm-exit').addEventListener('click', () => {
    trackReg('breath');
    renderGrowth();
    closeInstantCalm();
  }, { once: true });
}

function closeInstantCalm() {
  if (instantCalmInterval) clearInterval(instantCalmInterval);
  instantCalmInterval = null;
  instantCalm.classList.add('fade-out');
  setTimeout(() => { instantCalm.style.display = 'none'; }, 800);
}

// ===== SCIENCE TIPS (teach WHY it works) =====
const scienceTips = [
  "Deep breathing activates your vagus nerve, which tells your brain to switch from 'fight-or-flight' to 'rest-and-digest.' You're literally rewiring your stress response.",
  "The 5-4-3-2-1 grounding technique works because it redirects your prefrontal cortex to sensory input, interrupting the anxiety loop in your amygdala.",
  "Each time you regulate yourself, you strengthen neural pathways for calm. It's like a muscle — the more you use it, the stronger it gets.",
  "Studies show that naming your emotion ('I feel anxious') reduces amygdala activity by up to 50%. Just acknowledging the feeling is a regulation skill.",
  "After about 20 repetitions of a coping technique, your brain starts to automate it. You're building an automatic calm response.",
  "ADHD brains have lower baseline dopamine, which makes emotional regulation harder — but not impossible. Every practice session builds your capacity.",
  "Your nervous system has 'memory.' Each time you calm down from a heightened state, your body remembers the way back faster next time.",
  "Box breathing (4 counts in, hold, out, hold) increases heart rate variability, which is a biomarker for emotional resilience. You're literally building resilience.",
  "The feeling of being overwhelmed is your brain trying to process too many threads at once. Externalizing them (brain dump) frees working memory and reduces that feeling.",
  "Research shows that self-regulation is not a fixed trait — it's a learnable skill. You're not broken; you're in training.",
];

// ===== GROWTH RENDERING =====
function renderGrowth() {
  const section = document.getElementById('growth-section');
  const r = state.reg || { breathUses: 0, groundUses: 0, selfCalmed: 0 };
  const total = r.breathUses + r.groundUses + r.selfCalmed;

  if (total === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  document.getElementById('growth-breath').textContent = r.breathUses;
  document.getElementById('growth-ground').textContent = r.groundUses;
  document.getElementById('growth-self').textContent = r.selfCalmed;

  const maxForMeter = 30;
  const pct = Math.min((total / maxForMeter) * 100, 100);
  document.getElementById('growth-meter-fill').style.width = pct + '%';

  const phase = getGrowthPhase();
  const msgEl = document.getElementById('growth-message');

  const growthMessages = {
    guided: [
      "You're learning to recognize what your body needs. That's step one.",
      "Every breathing exercise is a deposit in your emotional resilience bank.",
      "You're building skills that will last a lifetime. Keep going.",
    ],
    growing: [
      "You're starting to catch yourself before spiraling. That's huge.",
      "Notice how it gets a little easier each time? That's your brain adapting.",
      "You're becoming your own best regulator. The app is just the training ground.",
    ],
    independent: [
      "You've built real, lasting regulation skills. This app is your backup, not your lifeline.",
      "You can do this anywhere — in a meeting, on a walk, in bed. No app needed.",
      "The goal was always for you to not need us. Look how far you've come.",
    ],
  };
  const msgs = growthMessages[phase];
  msgEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];

  const tipEl = document.getElementById('growth-tip');
  const tipText = document.getElementById('growth-tip-text');
  if (total >= 3) {
    tipEl.style.display = 'flex';
    tipText.textContent = scienceTips[total % scienceTips.length];
  }
}

// ===== GROUNDING EXERCISE (5-4-3-2-1) =====
const groundingOverlay = document.getElementById('grounding-overlay');
const groundingSteps = document.querySelectorAll('.grounding-step');
const groundingProgressBar = document.getElementById('grounding-progress-bar');
const groundingComplete = document.getElementById('grounding-complete');

let groundCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
let currentGroundStep = 5;
const groundTargets = { 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 };

function openGroundingExercise() {
  groundingOverlay.style.display = 'block';
  groundCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  currentGroundStep = 5;
  groundingComplete.style.display = 'none';
  document.getElementById('grounding-steps').style.display = 'block';
  groundingProgressBar.style.width = '0%';

  groundingSteps.forEach(s => {
    s.classList.remove('active');
    const step = s.dataset.step;
    document.getElementById(`ground-items-${step}`).innerHTML = '';
    document.getElementById(`ground-count-${step}`).textContent = '0';
    document.getElementById(`ground-input-${step}`).value = '';
  });
  document.querySelector('.grounding-step[data-step="5"]').classList.add('active');
}

function closeGroundingExercise() {
  groundingOverlay.style.display = 'none';
}

function addGroundItem(step) {
  const input = document.getElementById(`ground-input-${step}`);
  const val = input.value.trim();
  if (!val) return;

  groundCounts[step]++;
  const container = document.getElementById(`ground-items-${step}`);
  const tag = document.createElement('span');
  tag.className = 'ground-tag';
  tag.textContent = val;
  container.appendChild(tag);

  input.value = '';
  document.getElementById(`ground-count-${step}`).textContent = groundCounts[step];

  const totalDone = Object.values(groundCounts).reduce((a, b) => a + b, 0);
  const totalNeeded = 5 + 4 + 3 + 2 + 1;
  groundingProgressBar.style.width = `${(totalDone / totalNeeded) * 100}%`;

  if (groundCounts[step] >= groundTargets[step]) {
    const nextStep = step - 1;
    if (nextStep >= 1) {
      currentGroundStep = nextStep;
      setTimeout(() => {
        groundingSteps.forEach(s => s.classList.remove('active'));
        document.querySelector(`.grounding-step[data-step="${nextStep}"]`).classList.add('active');
        document.getElementById(`ground-input-${nextStep}`).focus();
      }, 400);
    } else {
      trackReg('ground');
      setTimeout(() => {
        document.getElementById('grounding-steps').style.display = 'none';
        groundingComplete.style.display = 'block';
        renderGrowth();
      }, 400);
    }
  }
}

document.getElementById('grounding-close').addEventListener('click', closeGroundingExercise);

document.querySelectorAll('.grounding-add').forEach(btn => {
  btn.addEventListener('click', () => addGroundItem(parseInt(btn.dataset.step)));
});

document.querySelectorAll('.grounding-input').forEach(input => {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const step = parseInt(input.id.split('-').pop());
      addGroundItem(step);
    }
  });
});

document.getElementById('grounding-done').addEventListener('click', closeGroundingExercise);

// SOS calm button — instant breathing, not a task-based exercise
document.getElementById('sos-calm').addEventListener('click', () => openInstantCalm('overwhelmed'));

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
    switchTab(tab.dataset.tab);
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
  renderGrowth();
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

// ===== REELS & TOPICS (shared vertical deck) =====
const REEL_VIDEO_BASE = 'https://storage.googleapis.com/gtv-videos-bucket/sample/';
const reelVideoSources = [
  `${REEL_VIDEO_BASE}ForBiggerBlazes.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerEscapes.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerFun.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerJoyrides.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerMeltdowns.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerBlazes.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerEscapes.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerFun.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerJoyrides.mp4`,
  `${REEL_VIDEO_BASE}ForBiggerMeltdowns.mp4`,
];

function makeYouTubeEmbedUrl(id, start = 0, end = 15) {
  const q = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    loop: '1',
    playlist: id,
    start: String(start),
    end: String(end),
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`;
}

const adhdYouTubeClips = [
  makeYouTubeEmbedUrl('BEwJ9r0FAg4'),
  makeYouTubeEmbedUrl('LZwSf6ZZRlI'),
  makeYouTubeEmbedUrl('nEmOpzfivv4'),
  makeYouTubeEmbedUrl('unAW3raLvJY'),
  makeYouTubeEmbedUrl('u77I0AZRvZA'),
  makeYouTubeEmbedUrl('ADf_J_rPkuc'),
  makeYouTubeEmbedUrl('I2Y2OedGMj0'),
  makeYouTubeEmbedUrl('_SilFHwyBpU'),
  makeYouTubeEmbedUrl('y41npkFKrdg'),
  makeYouTubeEmbedUrl('Mx6YlI19bL0'),
];

function getYouTubeThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

const reelsData = [
  {
    emoji: '🧠',
    badge: 'Understanding ADHD',
    title: 'Your Brain Isn\'t Broken',
    body: 'ADHD is a difference in how your brain manages dopamine and norepinephrine. You\'re not lazy or stupid — your brain is wired to seek stimulation. Understanding this is the first step to working WITH your brain, not against it.',
    action: 'Swipe for the next clip',
    theme: 1,
    youtubeEmbed: adhdYouTubeClips[0],
    youtubeThumb: getYouTubeThumb('BEwJ9r0FAg4'),
  },
  {
    emoji: '⏱️',
    badge: 'Time Blindness',
    title: 'Why 5 Minutes Feels Like 5 Hours (or 5 Seconds)',
    body: 'ADHD brains struggle with time perception. Try this: set timers for everything, not as pressure but as anchors. External time cues replace the internal clock your brain skips over. Body doubling and visual timers help too.',
    action: 'Try the Focus Timer →',
    theme: 4,
    youtubeEmbed: adhdYouTubeClips[1],
    youtubeThumb: getYouTubeThumb('LZwSf6ZZRlI'),
  },
  {
    emoji: '🌊',
    badge: 'Emotional Regulation',
    title: 'The Emotion Wave',
    body: 'ADHD emotions hit harder and faster. But here\'s the secret: emotions are waves, not tsunamis. They peak in about 90 seconds. If you can ride that wave — breathe, feel it, don\'t react — it WILL pass. Every time.',
    action: 'You\'re building this skill',
    theme: 2,
    youtubeEmbed: adhdYouTubeClips[2],
    youtubeThumb: getYouTubeThumb('nEmOpzfivv4'),
  },
  {
    emoji: '🗑️',
    badge: 'Working Memory',
    title: 'Get It Out of Your Head',
    body: 'Your working memory holds ~3 things. Non-ADHD brains: maybe 7. That\'s why you feel overwhelmed — too many tabs open. The fix? Externalize everything. Write it down. Brain dump it. Your phone, a notebook, this app — they\'re your external hard drive.',
    action: 'Try Brain Dump →',
    theme: 6,
    youtubeEmbed: adhdYouTubeClips[3],
    youtubeThumb: getYouTubeThumb('unAW3raLvJY'),
  },
  {
    emoji: '🏔️',
    badge: 'Task Paralysis',
    title: 'The Mountain Is Made of Pebbles',
    body: 'When a task feels impossible, your brain freezes. It\'s not laziness — it\'s your prefrontal cortex overwhelmed by the gap between "here" and "done." The hack: shrink the task until it\'s laughably small. "Open the document." That\'s it. Momentum does the rest.',
    action: 'Break tasks down →',
    theme: 5,
    youtubeEmbed: adhdYouTubeClips[4],
    youtubeThumb: getYouTubeThumb('u77I0AZRvZA'),
  },
  {
    emoji: '💤',
    badge: 'Rest & Recovery',
    title: 'Rest Is Productive',
    body: 'ADHD brains burn more glucose trying to focus. You\'re not imagining the exhaustion — your brain is literally working harder than neurotypical brains to do the same things. Rest isn\'t quitting. It\'s refueling. Schedule it like a meeting.',
    action: 'Be kind to yourself',
    theme: 9,
    youtubeEmbed: adhdYouTubeClips[5],
    youtubeThumb: getYouTubeThumb('ADf_J_rPkuc'),
  },
  {
    emoji: '🎯',
    badge: 'Hyperfocus',
    title: 'Your Superpower (With a Catch)',
    body: 'Hyperfocus isn\'t a myth — it\'s your brain finding the perfect dopamine match. The catch: you can\'t always choose what triggers it. The strategy: pair boring tasks with novelty (new playlist, new location, body doubling). Make your brain WANT to engage.',
    action: 'Channel it wisely',
    theme: 3,
    youtubeEmbed: adhdYouTubeClips[6],
    youtubeThumb: getYouTubeThumb('I2Y2OedGMj0'),
  },
  {
    emoji: '🔄',
    badge: 'Habit Building',
    title: 'Forget Discipline. Build Systems.',
    body: 'Willpower is a depletable resource, and ADHD brains start with less. Stop relying on motivation — it\'s weather, not climate. Instead: reduce friction (put things where you\'ll trip over them), stack habits (after coffee → brain dump), and forgive the misses.',
    action: 'Systems > willpower',
    theme: 7,
    youtubeEmbed: adhdYouTubeClips[7],
    youtubeThumb: getYouTubeThumb('_SilFHwyBpU'),
  },
  {
    emoji: '🤝',
    badge: 'Self-Compassion',
    title: 'You\'re Not Behind',
    body: 'You\'re comparing your chapter 3 to someone else\'s chapter 20. ADHD means you took a different path — not a wrong one. Every strategy you\'ve developed, every workaround you\'ve built? That\'s resilience most people never need to develop.',
    action: 'You\'re doing great',
    theme: 10,
    youtubeEmbed: adhdYouTubeClips[8],
    youtubeThumb: getYouTubeThumb('y41npkFKrdg'),
  },
  {
    emoji: '🌱',
    badge: 'Growth',
    title: 'Regulation Is a Skill, Not a Trait',
    body: 'Every time you pause before reacting, breathe through anxiety, or name your emotion — you\'re strengthening neural pathways. After ~20 repetitions, your brain starts automating the response. You\'re not managing ADHD. You\'re training your brain. And it\'s working.',
    action: 'Keep growing',
    theme: 8,
    youtubeEmbed: adhdYouTubeClips[9],
    youtubeThumb: getYouTubeThumb('Mx6YlI19bL0'),
  },
];

const topicsData = [
  {
    emoji: '🌙',
    badge: 'Topic · Sleep',
    title: 'Sleep Is a Skill Stack',
    body: 'ADHD and delayed sleep phase often go together. Wind-down starts before bed: same wake time, dim light, phone out of the room. You\'re not "bad at sleep" — you\'re fighting biology plus stimulation. Small consistent cues beat heroic willpower.',
    action: 'Swipe for more topics',
    theme: 9,
    videoSrc: reelVideoSources[3],
  },
  {
    emoji: '🍎',
    badge: 'Topic · Fuel',
    title: 'Food, Glucose, and Focus',
    body: 'Skipping meals crashes working memory faster for ADHD brains. Protein + complex carbs at breakfast isn\'t moralizing — it\'s stabilizing blood sugar so your meds and your attention have something to work with.',
    action: 'Next: relationships',
    theme: 5,
    videoSrc: reelVideoSources[0],
  },
  {
    emoji: '💬',
    badge: 'Topic · RSD',
    title: 'Rejection Sensitivity Is Real',
    body: 'That punch-in-the-gut feeling after a neutral comment? It might be RSD — not you being "too sensitive." Name it, wait 90 seconds, check the story you\'re telling yourself. Support beats self-attack.',
    action: 'You deserve gentleness',
    theme: 2,
    videoSrc: reelVideoSources[2],
  },
  {
    emoji: '💼',
    badge: 'Topic · Work',
    title: 'Accommodations Are Tools',
    body: 'Noise-canceling headphones, written instructions, flexible deadlines — these aren\'t cheating. They level the field. You don\'t owe anyone a performance of struggle to "earn" support.',
    action: 'Ask for what helps',
    theme: 4,
    videoSrc: reelVideoSources[1],
  },
  {
    emoji: '🏃',
    badge: 'Topic · Movement',
    title: 'Your Brain Needs the Body',
    body: 'Movement isn\'t a distraction from work — it\'s fuel for dopamine and norepinephrine. A walk before a hard task can do more than another cup of coffee.',
    action: 'Micro-movements count',
    theme: 3,
    videoSrc: reelVideoSources[8],
  },
  {
    emoji: '📱',
    badge: 'Topic · Tech',
    title: 'Phones Are Slot Machines',
    body: 'Infinite scroll is engineered for your dopamine system. Friction helps: grayscale mode, app timers, leaving the phone in another room for focus blocks — not shame, just design.',
    action: 'Design your environment',
    theme: 6,
    videoSrc: reelVideoSources[4],
  },
  {
    emoji: '📚',
    badge: 'Topic · Learning',
    title: 'Study Like You Have ADHD',
    body: 'Pomodoros, active recall, teaching the wall, changing locations when stuck — boring methods fail you because your brain needs novelty and urgency. Work with that, not against it.',
    action: 'Experiment, don\'t grind',
    theme: 1,
    videoSrc: reelVideoSources[6],
  },
  {
    emoji: '💸',
    badge: 'Topic · Money',
    title: 'Impulse and Money',
    body: 'Delayed gratification is harder when the future feels fuzzy. Try friction: 24-hour cart rule, separate "fun" account, automation for bills — systems that decide when you\'re calm for you when you\'re not.',
    action: 'Automate the boring stuff',
    theme: 8,
    videoSrc: reelVideoSources[7],
  },
  {
    emoji: '🧹',
    badge: 'Topic · Environment',
    title: 'Clutter Isn\'t a Character Flaw',
    body: 'Object permanence quirks mean "out of sight, out of mind" — then shame piles on. Visible homes for things, five-minute resets, and "good enough" beats perfect systems you\'ll never maintain.',
    action: 'Visibility beats pretty bins',
    theme: 10,
    videoSrc: reelVideoSources[5],
  },
  {
    emoji: '💊',
    badge: 'Topic · Meds',
    title: 'Medication Is a Personal Science',
    body: 'Stimulants help many people; they\'re not "cheating" your personality away. Finding the right dose takes time and honest check-ins with a prescriber you trust — and it\'s okay if your path isn\'t linear.',
    action: 'Advocate for yourself',
    theme: 7,
    videoSrc: reelVideoSources[9],
  },
];

function pauseAllReelVideos() {
  document.querySelectorAll('#panel-reels video.reel-video, #panel-topics video.reel-video').forEach(v => {
    v.pause();
  });
}

function initReelDeck(cfg) {
  let currentIndex = 0;

  function track() { return document.getElementById(cfg.trackId); }
  function viewport() { return document.getElementById(cfg.viewportId); }
  function dotsEl() { return document.getElementById(cfg.dotsId); }

  function pauseTrackVideos() {
    track()?.querySelectorAll('video').forEach(v => v.pause());
  }

  function playActiveSlideVideo() {
    const slides = track()?.querySelectorAll('.reel');
    const slide = slides?.[currentIndex];
    const vid = slide?.querySelector('video');
    if (vid) {
      vid.muted = true;
      vid.play().catch(() => {});
    }
  }

  function goTo(idx) {
    if (idx < 0 || idx >= cfg.data.length) return;
    currentIndex = idx;
    const vp = viewport();
    const tr = track();
    const dots = dotsEl();
    if (!vp || !tr || !dots) return;

    pauseTrackVideos();

    let slideHeight = vp.offsetHeight || vp.getBoundingClientRect().height;
    const firstSlide = tr.querySelector('.reel');
    if (!slideHeight && firstSlide) slideHeight = firstSlide.offsetHeight;
    if (!slideHeight) slideHeight = Math.round(window.innerHeight * 0.72);

    tr.style.transform = `translateY(-${idx * slideHeight}px)`;

    dots.querySelectorAll('.reel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });

    const prevBtn = document.getElementById(cfg.prevId);
    const nextBtn = document.getElementById(cfg.nextId);
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === cfg.data.length - 1;

    playActiveSlideVideo();
  }

  function slideHtml(item, i, showHint) {
    const hasYouTube = !!item.youtubeEmbed;
    const hasVideo = !!item.videoSrc || hasYouTube;
    const thumbStyle = item.youtubeThumb ? ` style="background-image:url('${item.youtubeThumb}');"` : '';
    const videoBlock = hasYouTube
      ? `<div class="reel-media reel-media-youtube"${thumbStyle}><iframe class="reel-youtube" src="${item.youtubeEmbed}" title="${escHtml(item.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe><div class="reel-scrim" aria-hidden="true"></div></div>`
      : hasVideo
      ? `<div class="reel-media"><video class="reel-video" src="${item.videoSrc}" playsinline muted loop preload="metadata"></video><div class="reel-scrim" aria-hidden="true"></div></div>`
      : '';
    const extraClass = hasVideo ? ' reel-has-video' : '';
    return `
      <div class="reel reel-theme-${item.theme}${extraClass}">
        ${videoBlock}
        <div class="reel-fg">
          <span class="reel-counter">${i + 1} / ${cfg.data.length}</span>
          <span class="reel-badge">${escHtml(item.badge)}</span>
          <div class="reel-emoji">${item.emoji}</div>
          <h3 class="reel-title">${escHtml(item.title)}</h3>
          <p class="reel-body">${escHtml(item.body)}</p>
          <span class="reel-action">${escHtml(item.action)}</span>
          ${showHint ? '<span class="reel-swipe-hint">Swipe up or use arrows</span>' : ''}
        </div>
      </div>
    `;
  }

  function build() {
    const tr = track();
    const dots = dotsEl();
    if (!tr || !dots) return;
    tr.innerHTML = '';
    dots.innerHTML = '';
    cfg.data.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = slideHtml(item, i, i === 0).trim();
      tr.appendChild(wrap.firstElementChild);
      const dot = document.createElement('div');
      dot.className = `reel-dot${i === 0 ? ' active' : ''}`;
      dot.addEventListener('click', () => goTo(i));
      dots.appendChild(dot);
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => goTo(currentIndex));
    });
  }

  function bindNav() {
    document.getElementById(cfg.prevId)?.addEventListener('click', () => goTo(currentIndex - 1));
    document.getElementById(cfg.nextId)?.addEventListener('click', () => goTo(currentIndex + 1));
  }

  function bindGestures() {
    const vp = viewport();
    const tr = track();
    if (!vp || !tr) return;

    let startY = 0;
    let delta = 0;
    let gestureStartMs = 0;

    vp.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
      delta = 0;
      gestureStartMs = performance.now();
      tr.style.transition = 'none';
    }, { passive: true });

    vp.addEventListener('touchmove', e => {
      delta = startY - e.touches[0].clientY;
      const slideHeight = vp.offsetHeight || tr.querySelector('.reel')?.offsetHeight || Math.round(window.innerHeight * 0.72);
      const offset = -(currentIndex * slideHeight) - delta * 0.4;
      tr.style.transform = `translateY(${offset}px)`;
    }, { passive: true });

    vp.addEventListener('touchend', () => {
      const elapsed = Math.max(1, performance.now() - gestureStartMs);
      const velocity = Math.abs(delta) / elapsed; // px per ms
      const slideHeight = vp.offsetHeight || tr.querySelector('.reel')?.offsetHeight || Math.round(window.innerHeight * 0.72);
      const distanceThreshold = slideHeight * 0.18;
      const velocityThreshold = 0.55;

      tr.style.transition = 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)';
      if (delta > distanceThreshold || velocity > velocityThreshold && delta > 0) {
        goTo(currentIndex + 1);
      } else if (delta < -distanceThreshold || velocity > velocityThreshold && delta < 0) {
        goTo(currentIndex - 1);
      } else {
        goTo(currentIndex);
      }
      delta = 0;
    });

    let wheelTimeout = null;
    vp.addEventListener('wheel', ev => {
      if (wheelTimeout) return;
      wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 380);
      if (ev.deltaY > 25) goTo(currentIndex + 1);
      else if (ev.deltaY < -25) goTo(currentIndex - 1);
    }, { passive: true });
  }

  function onResize() {
    const panel = document.getElementById(cfg.panelId);
    if (panel?.classList.contains('active')) goTo(currentIndex);
  }

  bindNav();
  bindGestures();
  build();

  return {
    goTo,
    next() { goTo(currentIndex + 1); },
    prev() { goTo(currentIndex - 1); },
    onResize,
    tabName: cfg.tabName,
  };
}

const reelsDeck = initReelDeck({
  panelId: 'panel-reels',
  viewportId: 'reels-viewport',
  trackId: 'reels-track',
  dotsId: 'reels-dots',
  prevId: 'reel-prev',
  nextId: 'reel-next',
  tabName: 'reels',
  data: reelsData,
});

const topicsDeck = initReelDeck({
  panelId: 'panel-topics',
  viewportId: 'topics-viewport',
  trackId: 'topics-track',
  dotsId: 'topics-dots',
  prevId: 'topic-prev',
  nextId: 'topic-next',
  tabName: 'topics',
  data: topicsData,
});

window.addEventListener('resize', () => {
  reelsDeck.onResize();
  topicsDeck.onResize();
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;

  if (e.key === '1') switchTab('dump');
  if (e.key === '2') switchTab('today');
  if (e.key === '3') switchTab('timer');
  if (e.key === '4') switchTab('reels');
  if (e.key === '5') switchTab('topics');
  if (e.key === '6') switchTab('wins');
  if (e.key === ' ' && document.querySelector('.tab[data-tab="timer"]')?.classList.contains('active')) {
    e.preventDefault();
    timerRunning ? pauseTimer() : startTimer();
  }

  if (document.querySelector('.tab[data-tab="reels"]')?.classList.contains('active')) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); reelsDeck.next(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); reelsDeck.prev(); }
  }
  if (document.querySelector('.tab[data-tab="topics"]')?.classList.contains('active')) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); topicsDeck.next(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); topicsDeck.prev(); }
  }
});

function switchTab(name) {
  pauseAllReelVideos();
  tabs.forEach(t => t.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');
  if (name === 'reels' || name === 'topics') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (name === 'reels') reelsDeck.onResize();
        if (name === 'topics') topicsDeck.onResize();
      });
    });
  }
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
if (['dump', 'today', 'timer', 'reels', 'topics', 'wins'].includes(hash)) {
  switchTab(hash);
}
