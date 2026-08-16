const STORAGE_KEY = 'deepStructure.worldIletIn.v1';
const ALBUM_ID = 'world-i-let-in';
const TOTAL_OBSERVATION_MS = 14 * 60 * 1000;

const panelCard = document.getElementById('worldPanelCard');
let activeTimer = null;

const phases = [
  {
    id: 'arrive',
    label: 'ARRIVE',
    start: 0,
    end: 2 * 60 * 1000,
    lead: 'Put the phone down.',
    lines: ['Don’t search for anything yet.', 'Just arrive.']
  },
  {
    id: 'let-it-come',
    label: 'LET IT COME',
    start: 2 * 60 * 1000,
    end: 10 * 60 * 1000,
    lead: 'Look around.',
    lines: [
      'Don’t search for anything specific.',
      'Let your attention go where it goes.',
      'You don’t have to stop yourself from judging. Just notice when observation becomes judgement.'
    ]
  },
  {
    id: 'widen',
    label: 'WIDEN THE FRAME',
    start: 10 * 60 * 1000,
    end: 14 * 60 * 1000,
    lead: 'Keep looking at the same place.',
    lines: [
      'Now notice what has been easy to overlook.',
      'What is quiet?',
      'What is small?',
      'What is at the edge of your attention?',
      'What was there all along?'
    ]
  }
];

const questions = [
  {
    id: 'q1',
    prompt: 'What reached you first?',
    type: 'single',
    options: [
      ['people', 'PEOPLE'],
      ['movement', 'MOVEMENT'],
      ['sound', 'SOUND'],
      ['space-objects', 'SPACE / OBJECTS'],
      ['small-details', 'SMALL DETAILS'],
      ['myself', 'MYSELF'],
      ['unknown', 'I DON’T KNOW']
    ]
  },
  {
    id: 'q2',
    prompt: 'What kept pulling your attention back?',
    type: 'single',
    options: [
      ['people', 'PEOPLE'],
      ['movement', 'MOVEMENT'],
      ['sound', 'SOUND'],
      ['beautiful-interesting', 'SOMETHING BEAUTIFUL / INTERESTING'],
      ['unpleasant', 'SOMETHING UNPLEASANT'],
      ['own-thoughts', 'MY OWN THOUGHTS'],
      ['nothing', 'NOTHING IN PARTICULAR']
    ]
  },
  {
    id: 'q3',
    prompt: 'What happened when you watched people or situations?',
    type: 'single',
    options: [
      ['mostly-facts', 'I MOSTLY NOTICED WHAT WAS ACTUALLY THERE'],
      ['some-stories', 'I SOMETIMES CREATED STORIES ABOUT WHAT I SAW'],
      ['many-assumptions', 'I OFTEN FOUND MYSELF MAKING ASSUMPTIONS'],
      ['changed', 'IT CHANGED THROUGHOUT THE EXPERIENCE'],
      ['unknown', 'I DON’T KNOW']
    ]
  },
  {
    id: 'q4',
    prompt: 'What changed as you stayed longer?',
    type: 'multi',
    max: 2,
    helper: 'Choose up to two.',
    options: [
      ['more-details', 'I NOTICED MORE DETAILS'],
      ['sounds-more', 'SOUNDS BECAME MORE PRESENT'],
      ['people-more', 'PEOPLE BECAME MORE PRESENT'],
      ['people-less', 'PEOPLE BECAME LESS CENTRAL'],
      ['self-more', 'I NOTICED MYSELF MORE'],
      ['restless', 'I BECAME RESTLESS'],
      ['not-much', 'NOT MUCH CHANGED']
    ]
  },
  {
    id: 'q5',
    prompt: 'What was most present for you at the end?',
    type: 'single',
    options: [
      ['people', 'PEOPLE'],
      ['movement', 'MOVEMENT'],
      ['sound', 'SOUND'],
      ['space-objects', 'SPACE / OBJECTS'],
      ['small-details', 'SMALL DETAILS'],
      ['myself', 'MYSELF'],
      ['unknown', 'I DON’T KNOW']
    ]
  },
  {
    id: 'q6',
    prompt: 'How did the place affect you?',
    type: 'multi',
    max: 2,
    helper: 'Choose up to two.',
    options: [
      ['calm', 'CALM'],
      ['curious', 'CURIOUS'],
      ['connected', 'CONNECTED'],
      ['tense', 'TENSE'],
      ['overstimulated', 'OVERSTIMULATED'],
      ['distant', 'DISTANT'],
      ['neutral', 'NEUTRAL'],
      ['something-else', 'SOMETHING ELSE']
    ]
  },
  {
    id: 'q7',
    prompt: 'When did you notice yourself judging what you saw?',
    type: 'single',
    options: [
      ['immediately', 'ALMOST IMMEDIATELY'],
      ['after-a-while', 'AFTER A WHILE'],
      ['occasionally', 'ONLY OCCASIONALLY'],
      ['hardly', 'I HARDLY NOTICED IT'],
      ['unknown', 'I’M NOT SURE']
    ]
  },
  {
    id: 'q8',
    prompt: 'Did you notice something near the end that had probably been there from the beginning?',
    type: 'single',
    options: [
      ['yes-clearly', 'YES — CLEARLY'],
      ['think-so', 'I THINK SO'],
      ['no', 'NO'],
      ['unknown', 'I’M NOT SURE']
    ]
  }
];

const labels = Object.fromEntries(
  questions.flatMap((question) => question.options).map(([value, label]) => [value, label])
);

function defaultState() {
  return {
    version: 1,
    unlocked: ['01'],
    experience01: {
      status: 'not-started',
      startedAt: null,
      completedAt: null,
      skippedAt: null,
      answers: {},
      recognition: null
    }
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return defaultState();
    return {
      ...defaultState(),
      ...saved,
      experience01: { ...defaultState().experience01, ...(saved.experience01 || {}) }
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stopTimer() {
  if (activeTimer) window.clearInterval(activeTimer);
  activeTimer = null;
}

function clearAndRender(node) {
  stopTimer();
  panelCard.replaceChildren(node);
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, className = 'pg-button') {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

function screen(kicker, title, body = []) {
  const root = el('section', 'perception-game pg-screen');
  const inner = el('div', 'pg-inner');
  inner.append(el('p', 'pg-kicker', kicker), el('h2', 'pg-title', title));
  body.forEach((line) => inner.append(el('p', 'pg-copy', line)));
  root.append(inner);
  return { root, inner };
}

function addActions(inner, ...nodes) {
  const actions = el('div', 'pg-actions');
  nodes.filter(Boolean).forEach((node) => actions.append(node));
  inner.append(actions);
}

function notifyPhaseChange() {
  if ('vibrate' in navigator) navigator.vibrate(45);
}

function returnToAlbum() {
  stopTimer();
  document.querySelector(`.world-object[data-world-id="${ALBUM_ID}"]`)?.click();
}

function unlock02(state) {
  if (!state.unlocked.includes('02')) state.unlocked.push('02');
  saveState(state);
}

function enhanceAlbum() {
  const title = panelCard.querySelector('.album-detail-copy h2');
  if (!title || title.textContent.trim() !== 'The World I Let In') return;
  if (panelCard.querySelector('.perception-entry-card')) return;

  const copy = panelCard.querySelector('.album-detail-copy');
  const sectionList = copy?.querySelector('.album-sections');
  if (!copy || !sectionList) return;

  const state = loadState();
  const card = el('section', 'perception-entry-card');
  card.append(el('p', 'pg-kicker', 'EXPERIENCE'));
  card.append(el('h3', 'perception-entry-title', 'The World I Let In — A Perception Game'));
  card.append(el('p', 'perception-entry-copy', '4 chapters · 16 experiences · about 20 minutes each. The real world is the playing field.'));
  card.append(el('p', 'perception-entry-line', 'There is nothing to win. There is something to notice.'));

  const status = el('div', 'perception-entry-status');
  if (state.experience01.status === 'completed') {
    status.textContent = 'NOTICE / 01 completed · NOTICE / 02 unlocked';
  } else if (state.experience01.status === 'skipped') {
    status.textContent = 'NOTICE / 01 skipped · NOTICE / 02 unlocked';
  } else if (state.experience01.status === 'in-progress') {
    status.textContent = 'NOTICE / 01 in progress';
  } else {
    status.textContent = 'NOTICE / 01 ready';
  }
  card.append(status);

  const enter = button(
    state.experience01.status === 'in-progress' ? 'RESUME EXPERIENCE' : 'ENTER EXPERIENCE',
    'pg-button perception-entry-button'
  );
  enter.addEventListener('click', showGameIntro);
  card.append(enter);
  sectionList.insertAdjacentElement('afterend', card);
}

function showGameIntro() {
  const state = loadState();
  const { root, inner } = screen('THE WORLD I LET IN', 'A PERCEPTION GAME', [
    '16 experiences. 4 chapters. The website guides you; the experience happens in the world around you.',
    'Your answers are stored only in this browser. They are used to reflect this playthrough, not to diagnose you.'
  ]);

  const meta = el('div', 'pg-meta-grid');
  [['04', 'CHAPTERS'], ['16', 'EXPERIENCES'], ['≈20', 'MINUTES EACH']].forEach(([value, labelText]) => {
    const item = el('div', 'pg-meta-item');
    item.append(el('strong', '', value), el('span', '', labelText));
    meta.append(item);
  });
  inner.append(meta, el('p', 'pg-manifesto', 'There is nothing to win. There is something to notice.'));

  const start = button(state.experience01.status === 'in-progress' ? 'CONTINUE' : 'BEGIN');
  start.addEventListener('click', showChapterIntro);
  const back = button('BACK TO ALBUM', 'pg-text-button');
  back.addEventListener('click', returnToAlbum);
  addActions(inner, start, back);
  clearAndRender(root);
}

function showChapterIntro() {
  const state = loadState();
  const { root, inner } = screen('CHAPTER I', 'NOTICE', [
    'Before you can choose what you let in, notice what enters on its own.'
  ]);

  const map = el('div', 'pg-chapter-map');
  const chapterData = [
    ['I', 'NOTICE', true],
    ['II', 'FILTER', false],
    ['III', 'INTERPRET', false],
    ['IV', 'LET IN', false]
  ];
  chapterData.forEach(([roman, name, active]) => {
    const chapter = el('div', `pg-chapter${active ? ' is-active' : ''}`);
    chapter.append(el('span', 'pg-chapter-number', roman), el('strong', '', name));
    map.append(chapter);
  });
  inner.append(map);

  if (state.experience01.status === 'completed' || state.experience01.status === 'skipped') {
    const progress = el('div', 'pg-progress-list');
    progress.append(progressRow('01', 'THE CROWD', state.experience01.status));
    progress.append(progressRow('02', 'NEXT EXPERIENCE', 'unlocked'));
    progress.append(progressRow('03', 'LOCKED', 'locked'));
    progress.append(progressRow('04', 'LOCKED', 'locked'));
    inner.append(progress);

    const view = button(state.experience01.status === 'completed' ? 'VIEW RECOGNITION 01' : 'RETURN TO EXPERIENCE 01');
    view.addEventListener('click', () => state.experience01.status === 'completed' ? showRecognition() : showExperienceCard());
    const next = button('NOTICE / 02 — UNLOCKED', 'pg-button pg-button-secondary');
    next.addEventListener('click', showExperience02Placeholder);
    addActions(inner, view, next);
  } else {
    const next = button(state.experience01.status === 'in-progress' ? 'RESUME NOTICE / 01' : 'ENTER NOTICE / 01');
    next.addEventListener('click', showExperienceCard);
    addActions(inner, next);
  }

  clearAndRender(root);
}

function progressRow(number, name, status) {
  const row = el('div', `pg-progress-row is-${status}`);
  row.append(el('span', 'pg-progress-number', number), el('strong', '', name));
  const mark = status === 'completed' ? '●' : status === 'skipped' ? '○' : status === 'unlocked' ? '→' : '·';
  row.append(el('span', 'pg-progress-mark', mark));
  return row;
}

function showExperienceCard() {
  const state = loadState();
  const exp = state.experience01;
  const { root, inner } = screen('NOTICE / 01', 'THE CROWD', [
    'A place. Many people. One point of view.',
    'Approx. 20 minutes. Travel time is not included.'
  ]);

  const facts = el('div', 'pg-facts');
  facts.append(el('span', '', 'OBSERVE'), el('span', '', 'REAL WORLD'), el('span', '', '≈20 MIN'));
  inner.append(facts);

  if (exp.status === 'in-progress' && exp.startedAt) {
    const elapsed = Date.now() - exp.startedAt;
    const resume = button(elapsed >= TOTAL_OBSERVATION_MS ? 'CONTINUE TO REFLECTION' : 'RESUME EXPERIENCE');
    resume.addEventListener('click', () => elapsed >= TOTAL_OBSERVATION_MS ? showReturn() : showTimedObservation());
    const restart = button('START AGAIN', 'pg-text-button');
    restart.addEventListener('click', showFindPlace);
    addActions(inner, resume, restart);
  } else {
    const start = button('START EXPERIENCE');
    start.addEventListener('click', showFindPlace);
    const skip = button('THIS ONE DOESN’T FIT ME', 'pg-text-button');
    skip.addEventListener('click', skipExperience01);
    addActions(inner, start, skip);
  }

  clearAndRender(root);
}

function showFindPlace() {
  const { root, inner } = screen('NOTICE / 01', 'FIND YOUR PLACE', [
    'Go somewhere in your area where several people are present: a square, café, park, station, shopping area, or another suitable place.',
    'Find a place where you can sit or stand comfortably and see what is happening around you.',
    'Choose somewhere you feel safe. Do not record people or stare at individuals. You only need the wider scene.'
  ]);

  const ready = button('I’M HERE');
  ready.addEventListener('click', () => {
    const state = loadState();
    state.experience01.status = 'in-progress';
    state.experience01.startedAt = Date.now();
    state.experience01.completedAt = null;
    state.experience01.skippedAt = null;
    state.experience01.answers = {};
    state.experience01.recognition = null;
    saveState(state);
    showTimedObservation();
  });
  const skip = button('THIS EXPERIENCE DOESN’T FIT ME', 'pg-text-button');
  skip.addEventListener('click', skipExperience01);
  addActions(inner, ready, skip);
  clearAndRender(root);
}

function showTimedObservation() {
  const state = loadState();
  const startedAt = state.experience01.startedAt;
  if (!startedAt) return showFindPlace();

  const elapsed = Math.max(0, Date.now() - startedAt);
  if (elapsed >= TOTAL_OBSERVATION_MS) return showReturn();

  const phase = phases.find((item) => elapsed >= item.start && elapsed < item.end) || phases[phases.length - 1];
  const { root, inner } = screen(`NOTICE / 01 · ${phase.label}`, phase.lead, phase.lines);
  root.classList.add('pg-timed-screen');

  const timerWrap = el('div', 'pg-timer');
  const timerTime = el('strong', 'pg-timer-time');
  const timerLabel = el('span', 'pg-timer-label', phase.label);
  timerWrap.append(timerTime, timerLabel);
  inner.prepend(timerWrap);

  const phone = el('p', 'pg-phone-away', phase.id === 'arrive' ? 'PUT THE PHONE DOWN.' : phase.id === 'widen' ? 'LOOK UP.' : 'LOOK. LISTEN. NOTICE.');
  inner.append(phone);

  const skip = button('THIS EXPERIENCE DOESN’T FIT ME', 'pg-text-button pg-skip-timed');
  skip.addEventListener('click', skipExperience01);
  inner.append(skip);

  clearAndRender(root);

  const tick = () => {
    const nowElapsed = Math.max(0, Date.now() - startedAt);
    if (nowElapsed >= TOTAL_OBSERVATION_MS) {
      notifyPhaseChange();
      return showReturn();
    }
    const current = phases.find((item) => nowElapsed >= item.start && nowElapsed < item.end);
    if (!current || current.id !== phase.id) {
      notifyPhaseChange();
      return showTimedObservation();
    }
    const remaining = Math.max(0, current.end - nowElapsed);
    timerTime.textContent = formatDuration(remaining);
    const phaseProgress = (nowElapsed - current.start) / (current.end - current.start);
    timerWrap.style.setProperty('--pg-progress', `${Math.min(1, Math.max(0, phaseProgress)) * 360}deg`);
  };

  tick();
  activeTimer = window.setInterval(tick, 1000);
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showReturn() {
  const { root, inner } = screen('NOTICE / 01', 'COME BACK', [
    'Take the phone again when you’re ready.',
    'Don’t try to give the right answers. There are none.'
  ]);
  const ready = button('I’M READY');
  ready.addEventListener('click', () => showQuestion(0));
  addActions(inner, ready);
  clearAndRender(root);
}

function showQuestion(index) {
  const state = loadState();
  const question = questions[index];
  if (!question) return showBuildRecognition();

  const { root, inner } = screen(`REFLECTION · ${String(index + 1).padStart(2, '0')} / ${questions.length}`, question.prompt);
  root.classList.add('pg-question-screen');
  if (question.helper) inner.append(el('p', 'pg-helper', question.helper));

  const options = el('div', 'pg-options');
  const existing = state.experience01.answers[question.id];
  const selected = new Set(Array.isArray(existing) ? existing : existing ? [existing] : []);

  question.options.forEach(([value, labelText]) => {
    const option = button(labelText, 'pg-option');
    option.dataset.value = value;
    option.classList.toggle('is-selected', selected.has(value));
    option.setAttribute('aria-pressed', selected.has(value) ? 'true' : 'false');
    option.addEventListener('click', () => {
      if (question.type === 'single') {
        selected.clear();
        selected.add(value);
        options.querySelectorAll('.pg-option').forEach((node) => {
          const isSelected = node.dataset.value === value;
          node.classList.toggle('is-selected', isSelected);
          node.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      } else if (selected.has(value)) {
        selected.delete(value);
        option.classList.remove('is-selected');
        option.setAttribute('aria-pressed', 'false');
      } else if (selected.size < (question.max || 1)) {
        selected.add(value);
        option.classList.add('is-selected');
        option.setAttribute('aria-pressed', 'true');
      }
      continueButton.disabled = selected.size === 0;
      if (question.type === 'multi') helperStatus.textContent = `${selected.size} / ${question.max} selected`;
    });
    options.append(option);
  });
  inner.append(options);

  const helperStatus = el('p', 'pg-selection-status', question.type === 'multi' ? `${selected.size} / ${question.max} selected` : '');
  if (question.type === 'multi') inner.append(helperStatus);

  const continueButton = button(index === questions.length - 1 ? 'BUILD MY RECOGNITION' : 'CONTINUE');
  continueButton.disabled = selected.size === 0;
  continueButton.addEventListener('click', () => {
    const fresh = loadState();
    fresh.experience01.answers[question.id] = question.type === 'multi' ? [...selected] : [...selected][0];
    saveState(fresh);
    showQuestion(index + 1);
  });
  const back = index > 0 ? button('BACK', 'pg-text-button') : null;
  if (back) back.addEventListener('click', () => showQuestion(index - 1));
  addActions(inner, continueButton, back);
  clearAndRender(root);
}

function showBuildRecognition() {
  const { root, inner } = screen('NOTICE / 01', 'BUILDING YOUR RECOGNITION…');
  const pulse = el('div', 'pg-recognition-pulse');
  inner.append(pulse, el('p', 'pg-copy pg-muted', 'Reflecting this playthrough — not analysing you.'));
  clearAndRender(root);

  window.setTimeout(() => {
    const state = loadState();
    const recognition = buildRecognition(state.experience01.answers);
    state.experience01.status = 'completed';
    state.experience01.completedAt = Date.now();
    state.experience01.recognition = recognition;
    unlock02(state);
    showRecognition();
  }, 1200);
}

function buildRecognition(answers) {
  const first = answers.q1 || 'unknown';
  const pull = answers.q2 || 'nothing';
  const final = answers.q5 || 'unknown';
  const resonance = Array.isArray(answers.q6) ? answers.q6 : [];
  const q4 = Array.isArray(answers.q4) ? answers.q4 : [];
  const q8 = answers.q8;
  const knownFocus = first !== 'unknown' && final !== 'unknown';
  const shifted = knownFocus && first !== final;

  let shiftText;
  if (shifted) shiftText = `Your attention moved from ${labels[first]} to ${labels[final]} while the place itself largely stayed the same.`;
  else if (knownFocus && first === final) shiftText = `${labels[first]} remained the strongest part of your experience from beginning to end.`;
  else shiftText = 'Your answers do not point to one clear beginning-to-end shift this time.';

  const expansionSignals = q4.filter((value) => ['more-details', 'sounds-more', 'people-less', 'self-more'].includes(value)).length;
  let frameText;
  if ((q8 === 'yes-clearly' || q8 === 'think-so') && (expansionSignals > 0 || q4.includes('more-details'))) {
    frameText = 'Something that was present earlier entered your experienced world later. Your frame of attention widened during the exercise.';
  } else if (q4.includes('not-much') && q8 === 'no') {
    frameText = 'Your answers show relatively little change in what entered your attention this time. Not every observation changes simply because we stay longer.';
  } else {
    frameText = 'Some parts of the scene changed in importance while others stayed stable. Your attention had its own hierarchy.';
  }

  let interpretationText;
  if (answers.q7 === 'immediately' || answers.q3 === 'many-assumptions') {
    interpretationText = 'You noticed interpretation entering your perception early.';
  } else if (answers.q3 === 'changed') {
    interpretationText = 'The boundary between observation and interpretation shifted during the experience.';
  } else if (answers.q7 === 'hardly' && answers.q3 === 'mostly-facts') {
    interpretationText = 'Interpretation stayed mostly in the background — or was difficult to notice during this experience.';
  } else {
    interpretationText = 'You noticed moments where observation and interpretation could be distinguished.';
  }

  return {
    first,
    pull,
    final,
    resonance,
    shifted,
    shiftText,
    frameText,
    interpretationText,
    closing: 'The world around you contained more than you could let in at once.'
  };
}

function showRecognition() {
  const state = loadState();
  const recognition = state.experience01.recognition || buildRecognition(state.experience01.answers);
  const { root, inner } = screen('RECOGNITION 01', 'THE CROWD');
  root.classList.add('pg-recognition-screen');

  const summary = el('div', 'pg-recognition-summary');
  summary.append(recognitionField('FIRST', labels[recognition.first] || 'I DON’T KNOW'));
  summary.append(recognitionField('PULLED YOU BACK', labels[recognition.pull] || 'NOTHING IN PARTICULAR'));
  summary.append(recognitionField('AT THE END', labels[recognition.final] || 'I DON’T KNOW'));
  summary.append(recognitionField('RESONANCE', recognition.resonance.length ? recognition.resonance.map((value) => labels[value]).join(' + ') : 'NOT SPECIFIED'));
  inner.append(summary);

  const narrative = el('div', 'pg-recognition-copy');
  [recognition.shiftText, recognition.frameText, recognition.interpretationText].forEach((text) => narrative.append(el('p', '', text)));
  narrative.append(el('p', 'pg-recognition-closing', recognition.closing));
  inner.append(narrative);

  const add = button('ADD TO MY WORLD');
  add.addEventListener('click', showProgress);
  const replay = button('PLAY THIS EXPERIENCE AGAIN', 'pg-text-button');
  replay.addEventListener('click', showFindPlace);
  addActions(inner, add, replay);
  clearAndRender(root);
}

function recognitionField(name, value) {
  const field = el('div', 'pg-recognition-field');
  field.append(el('span', '', name), el('strong', '', value));
  return field;
}

function showProgress() {
  const state = loadState();
  unlock02(state);
  const { root, inner } = screen('MY WORLD', 'NOTICE', [
    '1 experience completed. Your first observation is now part of this playthrough.'
  ]);
  const list = el('div', 'pg-progress-list');
  list.append(progressRow('01', 'THE CROWD', state.experience01.status));
  list.append(progressRow('02', 'NEXT EXPERIENCE', 'unlocked'));
  list.append(progressRow('03', 'LOCKED', 'locked'));
  list.append(progressRow('04', 'LOCKED', 'locked'));
  inner.append(list, el('p', 'pg-unlocked', 'NEXT EXPERIENCE UNLOCKED'));

  const next = button('NOTICE / 02');
  next.addEventListener('click', showExperience02Placeholder);
  const album = button('RETURN TO ALBUM', 'pg-text-button');
  album.addEventListener('click', returnToAlbum);
  addActions(inner, next, album);
  clearAndRender(root);
}

function showExperience02Placeholder() {
  const { root, inner } = screen('NOTICE / 02', 'UNLOCKED', [
    'The next experience is available in the progression. Its final exercise will be built next.',
    'NOTICE / 02 will deliberately use a different perception mode so the game does not repeat the same kind of task.'
  ]);
  const back = button('BACK TO MY WORLD');
  back.addEventListener('click', showProgress);
  const album = button('RETURN TO ALBUM', 'pg-text-button');
  album.addEventListener('click', returnToAlbum);
  addActions(inner, back, album);
  clearAndRender(root);
}

function skipExperience01() {
  const state = loadState();
  state.experience01.status = 'skipped';
  state.experience01.skippedAt = Date.now();
  state.experience01.startedAt = null;
  state.experience01.answers = {};
  state.experience01.recognition = null;
  unlock02(state);

  const { root, inner } = screen('NOTICE / 01', 'SKIPPED', [
    'Not every experience belongs in every situation.',
    'Skipping is part of choosing what you let in. You can return to this experience later.'
  ]);
  const continueButton = button('CONTINUE');
  continueButton.addEventListener('click', showProgress);
  addActions(inner, continueButton);
  clearAndRender(root);
}

const observer = new MutationObserver(() => {
  if (panelCard.querySelector('.perception-game')) return;
  stopTimer();
  window.requestAnimationFrame(enhanceAlbum);
});
observer.observe(panelCard, { childList: true, subtree: true });

window.addEventListener('visibilitychange', () => {
  if (!document.hidden && panelCard.querySelector('.pg-timed-screen')) showTimedObservation();
});

window.requestAnimationFrame(enhanceAlbum);
