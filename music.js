/*
  Leise Klaviermusik im Hintergrund.
  - Startet nur, wenn man den Lautsprecher-Knopf unten rechts antippt (Browser erlauben
    keinen Ton ohne Klick). Wer sie eingeschaltet hatte, bekommt sie beim nächsten Besuch
    mit dem ersten Klick oder Tippen auf der Seite wieder.
  - Vier Stücke im Loop, weich ein- und ausgeblendet.
  - Läuft das Radio oder ein Video, macht die Musik Pause und kommt danach von selbst zurück.
  Lautstärke über Web Audio, damit sie auch auf iPhones leise bleibt.
*/
const TRACKS = [
  { title: 'Autonomy', src: './assets/music/autonomy.mp3' },
  { title: 'Verdichtung', src: './assets/music/verdichtung.mp3' },
  { title: 'Neubeginn', src: './assets/music/neubeginn.mp3' },
  { title: 'Life', src: './assets/music/life.mp3' }
];
const LEVEL = 0.38; // bewusst leise, rund 10 % unter dem ersten Wert
const FADE_IN = 2.2;
const FADE_OUT = 0.9;
const STORE_KEY = 'ds-music';

const audio = new Audio();
audio.preload = 'none';
let index = 0;
let wanted = false;      // der Besucher möchte Musik
let audible = false;     // sie läuft gerade hörbar
let ctx = null;
let gain = null;
let pauseTimer = 0;
const blockers = new Set();

const readPref = () => { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } };
const writePref = value => { try { localStorage.setItem(STORE_KEY, value); } catch (e) {} };

/* ---------- Knopf ---------- */
const button = document.createElement('button');
button.type = 'button';
button.className = 'music-toggle';
button.setAttribute('aria-pressed', 'false');
button.setAttribute('aria-label', 'Hintergrundmusik einschalten');
button.innerHTML = `
  <svg class="music-icon music-icon--off" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
  <span class="music-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
const caption = document.createElement('span');
caption.className = 'music-caption';
caption.setAttribute('aria-live', 'polite');
const wrap = document.createElement('div');
wrap.className = 'music-control';
wrap.append(caption, button);
document.body.append(wrap);

let captionTimer = 0;
function showCaption(text, ms = 4200) {
  caption.textContent = text;
  wrap.classList.add('show-caption');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => wrap.classList.remove('show-caption'), ms);
}

function syncButton() {
  button.setAttribute('aria-pressed', String(wanted));
  button.setAttribute('aria-label', wanted ? 'Hintergrundmusik ausschalten' : 'Hintergrundmusik einschalten');
  wrap.classList.toggle('is-on', wanted);
  wrap.classList.toggle('is-audible', audible);
}

/* ---------- Ton ---------- */
function ensureGraph() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(audio).connect(gain);
    gain.connect(ctx.destination);
    return true;
  } catch (e) {
    ctx = null;
    return false;
  }
}

function ramp(to, seconds) {
  if (gain && ctx) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + seconds);
  } else {
    audio.volume = to; // Rückfall ohne Web Audio
  }
}

function setMedia() {
  if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: TRACKS[index].title,
    artist: 'Deep Structure',
    album: 'Klavier',
    artwork: [{ src: './assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
  });
}

function load(i) {
  index = (i + TRACKS.length) % TRACKS.length;
  audio.src = TRACKS[index].src;
  setMedia();
}

async function startAudible() {
  if (!wanted || blockers.size) return;
  clearTimeout(pauseTimer);
  ensureGraph();
  try { if (ctx && ctx.state === 'suspended') await ctx.resume(); } catch (e) {}
  if (!audio.src) load(index);
  try {
    await audio.play();
  } catch (e) {
    // Ohne Klick blockiert: beim nächsten Klick erneut versuchen.
    armFirstGesture();
    return;
  }
  audible = true;
  setMedia();
  ramp(LEVEL, FADE_IN);
  syncButton();
}

function stopAudible() {
  if (!audible && audio.paused) return;
  audible = false;
  ramp(0, FADE_OUT);
  clearTimeout(pauseTimer);
  pauseTimer = setTimeout(() => { if (!audible) audio.pause(); }, FADE_OUT * 1000 + 60);
  syncButton();
}

audio.addEventListener('ended', () => {
  load(index + 1);
  if (wanted && !blockers.size) {
    audio.play().then(() => { ramp(LEVEL, 0.4); showCaption(TRACKS[index].title); }).catch(() => {});
  }
});
let failures = 0;
audio.addEventListener('playing', () => { failures = 0; });
audio.addEventListener('error', () => {
  // Datei fehlt oder Netzwerkfehler: nächstes Stück starten, aber höchstens einmal rundherum.
  if (!wanted || !audio.getAttribute('src')) return;
  failures += 1;
  if (failures >= TRACKS.length) {
    failures = 0;
    wanted = false;
    audible = false;
    audio.removeAttribute('src');
    ramp(0, 0.1);
    syncButton();
    showCaption('Musik gerade nicht erreichbar', 3600);
    return;
  }
  load(index + 1);
  if (!blockers.size) {
    audio.play().then(() => { audible = true; ramp(LEVEL, 0.6); syncButton(); }).catch(() => {});
  }
});

function turnOn() {
  wanted = true;
  writePref('on');
  syncButton();
  showCaption(blockers.size ? 'Musik läuft nach dem Radio weiter' : TRACKS[index].title);
  startAudible();
}

function turnOff() {
  wanted = false;
  writePref('off');
  stopAudible();
  showCaption('Musik aus', 1800);
}

button.addEventListener('click', () => (wanted ? turnOff() : turnOn()));

// Medientasten gelten der Quelle, die gerade läuft: bei laufendem Radio stoppt Pause das Radio.
const radioOn = () => document.body.classList.contains('radio-playing');
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => { if (!radioOn()) turnOn(); });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (radioOn()) dispatchEvent(new CustomEvent('deepstructure:radio-stop'));
      else turnOff();
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      if (radioOn()) dispatchEvent(new CustomEvent('deepstructure:radio-stop'));
      else turnOff();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (radioOn()) return;
      load(index + 1);
      if (wanted) { audio.play().catch(() => {}); showCaption(TRACKS[index].title); }
    });
  } catch (e) {}
}

/* Wer die Musik beim letzten Besuch an hatte: mit dem ersten Klick wieder einschalten. */
let gestureArmed = false;
function armFirstGesture() {
  if (gestureArmed) return;
  gestureArmed = true;
  const go = event => {
    if (event.target && button.contains(event.target)) return; // der Knopf regelt sich selbst
    gestureArmed = false;
    removeEventListener('pointerdown', go, true);
    removeEventListener('keydown', go, true);
    if (wanted) startAudible();
  };
  addEventListener('pointerdown', go, true);
  addEventListener('keydown', go, true);
}
if (readPref() === 'on') {
  wanted = true;
  syncButton();
  armFirstGesture();
}

/* ---------- Radio und Videos haben Vorrang ---------- */
function block(key, on) {
  if (on) blockers.add(key); else blockers.delete(key);
  if (blockers.size) stopAudible();
  else if (wanted) startAudible();
}
new MutationObserver(() => {
  block('radio', document.body.classList.contains('radio-playing'));
  block('game', document.body.classList.contains('game-open'));
})
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('play', event => {
  if (event.target instanceof HTMLVideoElement && !event.target.muted) block(event.target, true);
}, true);
['pause', 'ended', 'emptied'].forEach(type => document.addEventListener(type, event => {
  if (event.target instanceof HTMLVideoElement) block(event.target, false);
}, true));

syncButton();
