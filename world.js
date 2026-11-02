import { vinylReleases, channels, shop, radio, vinylShelf, projects, projectsTeaser, projectDeck } from './data/world-data.js?v=6';

const world = document.getElementById('world');
const scene = document.getElementById('worldScene');
const objectsLayer = document.getElementById('worldObjects');
const panel = document.getElementById('worldPanel');
const panelCard = document.getElementById('worldPanelCard');
const panelClose = document.getElementById('worldPanelClose');
const indexPanel = document.getElementById('worldIndex');
const header = document.querySelector('.world-header');
const footer = document.querySelector('.world-footer');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 760px)');
const desktopLayout = { vinyl: [21, 47, 25], radio: [50, 39, 65], programmes: [79, 47, 20], shop: [50, 80, 10] };
const mobileLayout = { radio: [50, 22, 0], vinyl: [50, 44, 0], programmes: [50, 65, 0], shop: [50, 85, 0] };
const interactiveObjects = [];
let active = false;
let pointerNX = 0;
let pointerNY = 0;
let smoothX = 0;
let smoothY = 0;
let panelOpen = false;
let animationFrame = 0;
let lastAnimation = 0;
let radioObject = null;
let radioStatusText = null;
let radioControlButton = null;
let radioNowText = null;
let metadataTimer = 0;
let metadataLoading = false;
let metadataController = null;
let radioEnabled = false;
let lastRadioTitle = radio.nowPlayingFallback;
let lastFocusedElement = null;

const radioAudio = new Audio();
radioAudio.preload = 'none';
radioAudio.autoplay = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function label(title, caption) {
  const wrapper = el('span', 'world-object-label');
  wrapper.append(el('strong', '', title));
  if (caption) wrapper.append(el('span', '', caption));
  return wrapper;
}

function externalLink(title, url, className = 'world-link') {
  const link = el('a', className, title + ' ↗');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function createVinyl() {
  const button = el('button', 'world-object world-object--vinyl');
  button.type = 'button';
  button.dataset.worldId = 'vinyl';
  button.dataset.depth = '.48';
  button.dataset.phase = '0';
  button.setAttribute('aria-label', 'Vinyl von Deep Structure öffnen');
  button.style.setProperty('--cover', 'url("' + vinylShelf.label + '")');
  const disc = el('span', 'vinyl-disc');
  disc.append(el('span', 'vinyl-label'));
  button.append(disc, label('Vinyl', vinylShelf.caption));
  button.addEventListener('click', openVinyl);
  return button;
}

function createProgrammes() {
  const button = el('button', 'world-object world-object--deck');
  button.type = 'button';
  button.dataset.worldId = 'programmes';
  button.dataset.depth = '.4';
  button.dataset.phase = '4.2';
  button.setAttribute('aria-label', 'Apps & Spiele öffnen');
  const deck = el('span', 'project-deck');
  deck.setAttribute('aria-hidden', 'true');
  const back = el('span', 'project-card project-card--back');
  back.style.setProperty('--card', 'url("' + projectDeck[2] + '")');
  const middle = el('span', 'project-card project-card--middle');
  middle.style.setProperty('--card', 'url("' + projectDeck[1] + '")');
  const front = el('span', 'project-card project-card--front');
  // Vorne laufen alle Projektbilder nacheinander durch (reines CSS, weich überblendet).
  projectDeck.forEach((src, index) => {
    const face = el('span', 'project-card-face');
    face.style.backgroundImage = 'url("' + src + '")';
    face.style.animationDelay = (index * 3.2 - projectDeck.length * 3.2) + 's';
    front.append(face);
  });
  front.style.setProperty('--deck-cycle', (projectDeck.length * 3.2) + 's');
  deck.append(back, middle, front);
  button.append(deck, label('Apps & Spiele', 'Clash · Monsterjäger · Studio'));
  button.addEventListener('click', openProgrammes);
  return button;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

// Das Radio als Bassbox: der Lautsprecher ist das Deep-Structure-Zeichen mit kreisenden Lichtstreifen.
function speakerIllustration() {
  const speaker = el('span', 'ds-speaker');
  speaker.setAttribute('aria-hidden', 'true');
  const body = el('span', 'ds-speaker-body');
  const front = el('span', 'ds-speaker-front');

  const display = el('span', 'ds-speaker-display');
  const tag = el('span', 'ds-speaker-tag');
  tag.append(el('span', 'ds-speaker-lamp'), el('span', '', 'DS RADIO'));
  const eq = el('span', 'ds-speaker-eq');
  for (let i = 0; i < 12; i++) {
    const bar = el('i');
    bar.style.animationDelay = (-((i * 0.37) % 2.4)).toFixed(2) + 's';
    eq.append(bar);
  }
  display.append(tag, eq);

  const woofer = el('span', 'ds-speaker-woofer');
  woofer.append(el('span', 'ds-speaker-ring'), el('span', 'ds-speaker-ring'));
  const bars = el('span', 'ds-speaker-bars');
  const count = 56;
  for (let i = 0; i < count; i++) {
    const holder = el('span');
    holder.style.transform = `rotate(${(i / count * 360).toFixed(2)}deg) translateY(-3.6em)`;
    const light = el('i');
    light.style.animationDelay = (-((i * 0.53) % 2.6)).toFixed(2) + 's';
    light.style.animationDuration = (1.8 + ((i * 7) % 5) * 0.32).toFixed(2) + 's';
    holder.append(light);
    bars.append(holder);
  }
  const mark = svgEl('svg', { class: 'ds-speaker-mark', viewBox: '-100 -100 200 200', focusable: 'false' });
  mark.append(
    svgEl('circle', { cx: '0', cy: '0', r: '70', fill: '#050606', stroke: '#c9a86a', 'stroke-width': '2' }),
    svgEl('path', { d: 'M -65 26 A 70 70 0 0 0 65 26 Z', fill: '#2f8f86', opacity: '.9' }),
    svgEl('path', { d: 'M -65 26 L 65 26', stroke: '#e6fffb', 'stroke-width': '1.5' }),
    svgEl('polygon', { points: '0,-58 -46,22 46,22', fill: '#000', stroke: '#c9a86a', 'stroke-width': '2.5', 'stroke-linejoin': 'round' })
  );
  woofer.append(bars, mark);

  front.append(display, el('span', 'ds-speaker-tweeter'), woofer);
  body.append(el('span', 'ds-speaker-side'), front);
  speaker.append(el('span', 'ds-speaker-shadow'), body);
  return speaker;
}

function createRadio() {
  const button = el('button', 'world-object world-object--speaker');
  button.type = 'button';
  button.dataset.worldId = 'radio';
  button.dataset.depth = '.65';
  button.dataset.phase = '2.25';
  button.setAttribute('aria-label', 'Musik: Deep Structure Radio öffnen');
  button.append(speakerIllustration(), label('Musik', 'Deep Structure Radio · Live hören'));
  button.addEventListener('click', openRadio);
  radioObject = button;
  syncRadioState();
  return button;
}

function shopSign() {
  const sign = el('span', 'shop-sign');
  sign.setAttribute('aria-hidden', 'true');
  sign.append(el('span', 'shop-sign-brand', 'DEEP STRUCTURE'), el('span', 'shop-sign-title', 'WEBSHOP'), el('span', 'shop-sign-arrow', 'ENTDECKEN ↗'));
  return sign;
}

function createShop() {
  const button = el('button', 'world-object world-object--shop');
  button.type = 'button';
  button.dataset.worldId = 'shop';
  button.dataset.depth = '.3';
  button.dataset.phase = '3.6';
  button.setAttribute('aria-label', 'Deep Structure Webshop öffnen');
  button.append(shopSign());
  button.addEventListener('click', openShop);
  return button;
}

function openShop() {
  const detail = el('article', 'shop-detail');
  const visual = el('div', 'shop-detail-visual');
  visual.append(shopSign());
  const copy = el('div', 'shop-detail-copy');
  copy.append(el('h2', '', 'Webshop'));
  copy.append(el('p', 'detail-intro', 'Entdecke die Produkte von Deep Structure im eigenen Webshop.'));
  copy.append(externalLink('Zum Webshop', shop.url, 'world-link world-link--primary'));
  copy.append(el('p', 'shop-detail-note', 'Du suchst die Schallplatte?'));
  const vinyl = el('button', 'world-link', 'The Forest Does Not Forget ansehen');
  vinyl.type = 'button';
  vinyl.addEventListener('click', openVinyl);
  copy.append(vinyl);
  detail.append(visual, copy);
  openPanel(detail);
}

function renderWorld() {
  const fragment = document.createDocumentFragment();
  fragment.append(createVinyl());
  fragment.append(createRadio(), createProgrammes(), createShop());
  objectsLayer.replaceChildren(fragment);
  interactiveObjects.push(...objectsLayer.querySelectorAll('.world-object'));
  applyLayout();
  [['Musik', openRadio], ['Vinyl', openVinyl], ['Apps & Spiele', openProgrammes], ['Webshop', openShop]].forEach(([title, action]) => {
    const button = el('button', '', title);
    button.type = 'button';
    if (title === 'Webshop') button.className = 'shop-nav-link';
    button.addEventListener('click', action);
    indexPanel.append(button);
  });
}

function applyLayout() {
  const layout = mobileQuery.matches ? mobileLayout : desktopLayout;
  interactiveObjects.forEach(node => {
    const position = layout[node.dataset.worldId];
    node.style.setProperty('--x', position[0] + '%');
    node.style.setProperty('--y', position[1] + '%');
    node.style.setProperty('--z', position[2] + 'px');
  });
  updateMotion();
}

function openPanel(content) {
  if (!panelOpen) lastFocusedElement = document.activeElement;
  panelCard.querySelectorAll('video').forEach(video => video.pause());
  panelCard.replaceChildren(content);
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  panelOpen = true;
  scene.inert = header.inert = footer.inert = true;
  panelClose.focus({ preventScroll: true });
  requestAnimationFrame(() => { if (panelOpen) panelClose.focus({ preventScroll: true }); });
  updateMotion();
}

function closePanel() {
  panelCard.querySelectorAll('video').forEach(video => video.pause());
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  panelOpen = false;
  scene.inert = header.inert = footer.inert = false;
  if (radioAudio.paused) clearTimeout(metadataTimer);
  lastFocusedElement?.focus({ preventScroll: true });
  updateMotion();
}

function openVinyl() {
  const detail = el('article', 'vinyl-detail');
  const release = vinylReleases.find(item => item.published);
  if (!release) {
    detail.append(el('h2', '', 'Vinyl'), el('p', 'detail-intro', 'Neue Veröffentlichungen folgen.'));
    openPanel(detail);
    return;
  }
  const image = el('img', 'vinyl-cover');
  image.src = release.image;
  image.alt = 'Originalcover: ' + release.title;
  image.width = 908;
  image.height = 900;
  const copy = el('div', 'vinyl-detail-copy');
  copy.append(el('h2', '', release.title));
  copy.append(el('p', 'detail-intro', release.caption));
  const facts = el('ul', 'vinyl-facts');
  release.features.forEach(feature => facts.append(el('li', '', feature)));
  copy.append(facts, externalLink('Vinyl & Booklet bei elasticStage', release.purchaseUrl, 'world-link world-link--primary'));
  copy.append(externalLink('Deep Structure Webshop', shop.url));
  detail.append(image, copy);
  openPanel(detail);
}

function playableVideo(src, poster, label, buttonText) {
  const wrap = el('div', 'project-video');
  const video = el('video', 'games-pitch-video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.tabIndex = 0;
  if (poster) video.poster = poster;
  video.setAttribute('aria-label', label);
  const source = el('source');
  source.src = src;
  source.type = 'video/mp4';
  video.append(source, externalLink('Video öffnen', src));
  const play = el('button', 'world-link world-link--primary', buttonText);
  play.type = 'button';
  play.addEventListener('click', async () => {
    stopRadio();
    try { await video.play(); } catch { play.textContent = 'Video erneut starten'; }
  });
  video.addEventListener('play', () => {
    stopRadio();
    panelCard.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
    play.hidden = true;
  });
  video.addEventListener('ended', () => { play.hidden = false; });
  wrap.append(video, play);
  return wrap;
}

function projectViewer(project) {
  const viewer = el('div', 'project-viewer');
  const mainLink = el('a', 'project-main');
  mainLink.href = project.images[0].src;
  mainLink.target = '_blank';
  mainLink.rel = 'noopener';
  const main = el('img');
  main.src = project.images[0].src;
  main.alt = project.images[0].alt;
  main.loading = 'lazy';
  main.decoding = 'async';
  mainLink.append(main);
  mainLink.setAttribute('aria-label', project.images[0].alt + ' – groß öffnen');
  viewer.append(mainLink);
  if (project.images.length > 1) {
    const strip = el('div', 'project-thumbs');
    project.images.forEach((image, index) => {
      const thumb = el('button', 'project-thumb');
      thumb.type = 'button';
      thumb.setAttribute('aria-label', 'Bild zeigen: ' + image.alt);
      thumb.setAttribute('aria-pressed', String(index === 0));
      const pic = el('img');
      pic.src = image.src;
      pic.alt = '';
      pic.loading = 'lazy';
      thumb.append(pic);
      thumb.addEventListener('click', () => {
        strip.querySelectorAll('.project-thumb').forEach(node => node.setAttribute('aria-pressed', String(node === thumb)));
        main.classList.add('is-swapping');
        setTimeout(() => {
          main.src = image.src;
          main.alt = image.alt;
          mainLink.href = image.src;
          mainLink.setAttribute('aria-label', image.alt + ' – groß öffnen');
          main.classList.remove('is-swapping');
        }, 140);
      });
      strip.append(thumb);
    });
    viewer.append(strip);
  }
  return viewer;
}

function openProgrammes() {
  const detail = el('article', 'programmes-detail');
  detail.append(el('h2', '', 'Apps & Spiele'));
  detail.append(el('p', 'detail-intro', 'Woran Deep Structure gerade arbeitet: Spiele, Apps und Werkzeuge, alle selbst entwickelt.'));

  const teaser = el('section', 'games-pitch project-teaser');
  teaser.append(el('h3', '', projectsTeaser.title));
  teaser.append(playableVideo(projectsTeaser.src, projectsTeaser.poster, 'Teaser zu Clash of the Universe', 'Teaser abspielen'));
  detail.append(teaser);

  projects.forEach((project, index) => {
    const section = el('section', 'project-row' + (index % 2 ? ' project-row--flip' : ''));
    const copy = el('div', 'project-copy');
    copy.append(el('p', 'project-status', project.status), el('h3', '', project.title), el('p', '', project.text));
    if (project.link) {
      const link = el('a', 'world-link world-link--primary', project.link.label + ' ↗');
      link.href = project.link.href;
      link.target = '_blank';
      link.rel = 'noopener';
      copy.append(link);
    }
    section.append(projectViewer(project), copy);
    detail.append(section);
  });

  const game = el('section', 'programme-project');
  game.append(el('p', 'project-status', 'Spiel · zum Ausprobieren'));
  game.append(el('h3', '', 'The World I Let In'));
  game.append(el('p', '', 'Ein Wahrnehmungsspiel, das dich in die Welt um dich herum führt. Die erste Erfahrung kannst du hier ausprobieren.'));
  const launch = el('button', 'world-link world-link--primary', 'Wahrnehmungsspiel öffnen');
  launch.type = 'button';
  launch.addEventListener('click', () => window.dispatchEvent(new Event('deepstructure:perception-game')));
  game.append(launch);
  detail.append(game);

  const pitch = el('section', 'games-pitch');
  pitch.append(el('h3', '', 'Deep Structure Games'));
  pitch.append(playableVideo('./assets/games/deep-structure-games-pitch.mp4', '', 'Pitch-Video für Deep Structure Games', 'Pitch-Video abspielen'));
  detail.append(pitch, el('p', 'programmes-note', 'Weitere Anwendungen und Spiele folgen.'));
  openPanel(detail);
}

function syncRadioState(message = '') {
  const playing = !radioAudio.paused && Boolean(radioAudio.src);
  radioObject?.classList.toggle('is-playing', playing);
  document.body.classList.toggle('radio-playing', playing);

  if (radioControlButton) {
    radioControlButton.textContent = playing ? 'STOP' : 'PLAY';
    radioControlButton.classList.toggle('is-playing', playing);
    radioControlButton.setAttribute('aria-label', playing ? 'Deep Structure Radio stoppen' : 'Deep Structure Radio abspielen');
  }

  if (radioStatusText) {
    if (message) radioStatusText.textContent = message;
    else if (playing) radioStatusText.textContent = 'ON AIR — Live-Stream läuft';
    else if (radio.streamUrl) radioStatusText.textContent = 'Bereit zum Anhören';
    else radioStatusText.textContent = 'STREAM ENDPOINT NOT CONNECTED';
  }
}

async function refreshRadioMetadata() {
  clearTimeout(metadataTimer);
  if (!radioEnabled || metadataLoading || document.hidden || !radio.metadataUrl) return;
  metadataLoading = true;
  const controller = new AbortController();
  metadataController = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(radio.metadataUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Radio metadata: ${response.status}`);
    const data = await response.json();
    lastRadioTitle = data.now_playing?.song?.title || radio.nowPlayingFallback;
    if (radioEnabled && radioNowText?.isConnected) radioNowText.textContent = lastRadioTitle;
  } catch {
    // A metadata outage must never interrupt the audio stream.
  } finally {
    clearTimeout(timeout);
    metadataLoading = false;
    metadataController = null;
    if (radioEnabled && !document.hidden) {
      metadataTimer = setTimeout(refreshRadioMetadata, 15000);
    }
  }
}

async function startRadio() {
  if (!radio.streamUrl) {
    syncRadioState('Stream-Endpunkt ist vorbereitet, aber noch nicht eingetragen.');
    return;
  }

  try {
    radioEnabled = true;
    syncRadioState('Verbindung wird aufgebaut …');
    if (radioAudio.src !== radio.streamUrl) {
      radioAudio.src = radio.streamUrl;
      radioAudio.load();
    }
    await radioAudio.play();
    syncRadioState();
    refreshRadioMetadata();
  } catch (error) {
    stopRadio();
    console.error('Deep Structure Radio playback failed:', error);
    syncRadioState('Stream konnte nicht gestartet werden.');
  }
}

function stopRadio() {
  radioEnabled = false;
  clearTimeout(metadataTimer);
  metadataController?.abort();
  radioAudio.pause();
  radioAudio.removeAttribute('src');
  radioAudio.load();
  syncRadioState();
}

function toggleRadio() {
  const playing = !radioAudio.paused && Boolean(radioAudio.src);
  if (playing) stopRadio();
  else startRadio();
}

function openRadio() {
  const detail = el('article', 'radio-detail');

  const visual = el('div', 'radio-detail-visual radio-detail-visual--speaker');
  visual.append(speakerIllustration());

  const copy = el('div', 'radio-detail-copy');
  copy.append(el('h2', '', radio.title));
  copy.append(el('p', 'detail-intro', radio.caption));

  const now = el('div', 'radio-now-playing');
  radioNowText = el('strong', '', lastRadioTitle);
  radioNowText.setAttribute('aria-live', 'polite');
  now.append(el('span', 'radio-now-label', 'Jetzt im Radio'), radioNowText);
  copy.append(now);

  radioStatusText = el('p', 'radio-stream-status');
  radioControlButton = el('button', 'radio-play-button', 'PLAY');
  radioControlButton.type = 'button';
  radioControlButton.addEventListener('click', toggleRadio);

  const privacyNotice = el('p', 'radio-privacy-note', 'Mit PLAY verbindest du dich mit Asura Hosting. Dabei werden deine IP-Adresse und technische Verbindungsdaten übertragen. STOP beendet die Verbindung. ');
  const privacyLink = el('a', '', 'Datenschutz');
  privacyLink.href = './datenschutz.html#radio';
  privacyLink.target = '_blank';
  privacyLink.rel = 'noopener noreferrer';
  privacyNotice.append(privacyLink);
  const controls = el('div', 'radio-transport');
  controls.append(radioControlButton, radioStatusText);
  copy.append(privacyNotice, controls);
  const volumeLabel = el('label', 'radio-volume', 'Lautstärke');
  const volume = el('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '.05';
  volume.value = String(radioAudio.volume);
  volume.addEventListener('input', () => { radioAudio.volume = Number(volume.value); });
  volumeLabel.append(volume);
  copy.append(volumeLabel);
  const playerLink = el('a', 'radio-endpoint-note', 'Radio in einem eigenen Fenster öffnen ↗');
  playerLink.href = radio.playerUrl;
  playerLink.target = '_blank';
  playerLink.rel = 'noopener noreferrer';
  copy.append(playerLink);
  const platforms = el('div', 'music-platforms');
  channels.filter(channel => channel.url !== '#').forEach(channel => {
    platforms.append(externalLink(channel.label, channel.url));
  });
  copy.append(el('h3', 'radio-more-title', 'Mehr Musik von Deep Structure'), platforms);

  detail.append(visual, copy);
  openPanel(detail);
  syncRadioState();
  if (radioEnabled) refreshRadioMetadata();
}

radioAudio.addEventListener('playing', () => syncRadioState());
radioAudio.addEventListener('pause', () => syncRadioState());
radioAudio.addEventListener('error', () => { stopRadio(); syncRadioState('Stream-Verbindung fehlgeschlagen.'); });
radioAudio.addEventListener('waiting', () => syncRadioState('Stream wird gepuffert …'));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshRadioMetadata();
});


function onPointerMove(event) {
  if (!active || panelOpen || motionQuery.matches || mobileQuery.matches) return;
  pointerNX = (event.clientX / innerWidth - .5) * 2;
  pointerNY = (event.clientY / innerHeight - .5) * 2;
}

function canAnimate() {
  return active && !motionQuery.matches && !document.hidden && !panelOpen && !mobileQuery.matches;
}

function updateMotion() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  document.body.classList.toggle('world-motion-paused', !canAnimate());
  if (canAnimate()) {
    lastAnimation = 0;
    animationFrame = requestAnimationFrame(animate);
  } else {
    world.style.setProperty('--world-x', '0px');
    world.style.setProperty('--world-y', '0px');
    interactiveObjects.forEach(node => {
      ['--local-x', '--local-y'].forEach(prop => node.style.setProperty(prop, '0px'));
      ['--tilt-x', '--tilt-y'].forEach(prop => node.style.setProperty(prop, '0deg'));
    });
  }
}

function animate(now) {
  if (!canAnimate()) return;
  animationFrame = requestAnimationFrame(animate);
  if (lastAnimation && now - lastAnimation < 32) return;
  lastAnimation = now;
  smoothX += (pointerNX - smoothX) * .14;
  smoothY += (pointerNY - smoothY) * .14;
  world.style.setProperty('--world-x', (-smoothX * 3).toFixed(2) + 'px');
  world.style.setProperty('--world-y', (-smoothY * 2).toFixed(2) + 'px');
  interactiveObjects.forEach(node => {
    const depth = Number(node.dataset.depth);
    const phase = Number(node.dataset.phase);
    node.style.setProperty('--local-x', (smoothX * depth * 4).toFixed(2) + 'px');
    node.style.setProperty('--local-y', (smoothY * depth * 3 + Math.sin(now * .00055 + phase) * 2).toFixed(2) + 'px');
    node.style.setProperty('--tilt-x', (-smoothY * depth).toFixed(2) + 'deg');
    node.style.setProperty('--tilt-y', (smoothX * depth).toFixed(2) + 'deg');
  });
}

panelClose.addEventListener('click', closePanel);
panel.addEventListener('click', event => { if (event.target === panel) closePanel(); });
addEventListener('keydown', event => {
  if (!panelOpen) return;
  if (event.key === 'Escape') closePanel();
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]')]
    .filter(node => !node.disabled && node.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  if (!panel.contains(document.activeElement)) {
    event.preventDefault(); first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});
addEventListener('pointermove', onPointerMove, { passive: true });
document.addEventListener('visibilitychange', updateMotion);
mobileQuery.addEventListener('change', applyLayout);
motionQuery.addEventListener('change', updateMotion);
addEventListener('deepstructure:programmes', openProgrammes);
addEventListener('deepstructure:entered', () => {
  active = true;
  world.classList.add('is-ready');
  updateMotion();
});
if (location.hash === '#inside' || document.body.classList.contains('entered')) {
  active = true;
  world.classList.add('is-ready');
}
renderWorld();
