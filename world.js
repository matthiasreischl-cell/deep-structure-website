import { albums, memories, channels } from './data/world-data.js';

const world = document.getElementById('world');
const scene = document.getElementById('worldScene');
const objectsLayer = document.getElementById('worldObjects');
const panel = document.getElementById('worldPanel');
const panelCard = document.getElementById('worldPanelCard');
const panelClose = document.getElementById('worldPanelClose');
const indexButton = document.getElementById('worldIndexButton');
const indexPanel = document.getElementById('worldIndex');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 760px)');

const desktopLayout = {
  theater: [18, 25, 55],
  kintsugi: [40, 18, 92],
  faust: [70, 27, 30],
  'it-works': [29, 72, 84],
  'red-shoes': [62, 70, 48],
  memories: [12, 54, 18],
  channels: [84, 54, 68]
};

const mobileLayout = {
  theater: [28, 11, 15],
  kintsugi: [72, 21, 30],
  faust: [28, 35, 15],
  memories: [73, 42, 10],
  'it-works': [27, 58, 25],
  'red-shoes': [72, 67, 18],
  channels: [50, 86, 24]
};

const interactiveObjects = [];
let active = false;
let pointerNX = 0;
let pointerNY = 0;
let smoothX = 0;
let smoothY = 0;
let panelOpen = false;

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

function createVinyl(album, index) {
  const button = el('button', 'world-object world-object--vinyl');
  button.type = 'button';
  button.dataset.worldId = album.id;
  button.dataset.tone = album.tone;
  button.setAttribute('aria-label', `Open album world: ${album.title}`);
  button.style.setProperty('--cover', `url("${album.image}")`);
  button.dataset.depth = String(.55 + index * .09);
  button.dataset.phase = String(index * 1.17);

  const disc = el('span', 'vinyl-disc');
  disc.append(el('span', 'vinyl-label'));
  button.append(disc, label(album.title, album.caption));
  button.addEventListener('click', () => openAlbum(album));
  return button;
}

function createMemory() {
  const button = el('button', 'world-object world-object--memory');
  button.type = 'button';
  button.dataset.worldId = 'memories';
  button.dataset.depth = '.48';
  button.dataset.phase = '5.7';
  button.setAttribute('aria-label', 'Open memories');

  const photo = el('span', 'memory-photo');
  const img = document.createElement('img');
  img.src = memories.image;
  img.alt = '';
  photo.append(img);
  button.append(photo, label('Memories', 'Erinnerungen und persönliche Fragmente.'));
  button.addEventListener('click', openMemories);
  return button;
}

function createDoor() {
  const button = el('button', 'world-object world-object--door');
  button.type = 'button';
  button.dataset.worldId = 'channels';
  button.dataset.depth = '.62';
  button.dataset.phase = '3.3';
  button.setAttribute('aria-label', 'Open channels');

  const frame = el('span', 'door-frame');
  frame.append(el('span', 'door-light'), el('span', 'door-panel'));
  button.append(frame, label('Channels', 'Die Tür nach draußen.'));
  button.addEventListener('click', openChannels);
  return button;
}

function renderWorld() {
  const fragment = document.createDocumentFragment();
  albums.forEach((album, index) => fragment.append(createVinyl(album, index)));
  fragment.append(createMemory(), createDoor());
  objectsLayer.replaceChildren(fragment);
  interactiveObjects.splice(0, interactiveObjects.length, ...objectsLayer.querySelectorAll('.world-object'));
  applyLayout();
  renderIndex();
}

function applyLayout() {
  const layout = mobileQuery.matches ? mobileLayout : desktopLayout;
  interactiveObjects.forEach((node) => {
    const position = layout[node.dataset.worldId];
    if (!position) return;
    node.style.setProperty('--x', `${position[0]}%`);
    node.style.setProperty('--y', `${position[1]}%`);
    node.style.setProperty('--z', `${position[2]}px`);
  });
}

function renderIndex() {
  const fragment = document.createDocumentFragment();
  albums.forEach((album) => {
    const button = el('button', '', album.title);
    button.type = 'button';
    button.addEventListener('click', () => {
      indexPanel.classList.remove('is-open');
      openAlbum(album);
    });
    fragment.append(button);
  });
  fragment.append(document.createElement('hr'));

  const memoryButton = el('button', '', 'Memories');
  memoryButton.type = 'button';
  memoryButton.addEventListener('click', () => {
    indexPanel.classList.remove('is-open');
    openMemories();
  });

  const channelsButton = el('button', '', 'Channels');
  channelsButton.type = 'button';
  channelsButton.addEventListener('click', () => {
    indexPanel.classList.remove('is-open');
    openChannels();
  });

  fragment.append(memoryButton, channelsButton);
  indexPanel.replaceChildren(fragment);
}

function openPanel(content) {
  panelCard.replaceChildren(content);
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  panelOpen = true;
  panelClose.focus({ preventScroll: true });
}

function closePanel() {
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  panelOpen = false;
}

function openAlbum(album) {
  const detail = el('article', 'album-detail');
  const visual = el('div', 'album-detail-visual');
  visual.style.setProperty('--detail-cover', `url("${album.image}")`);

  const copy = el('div', 'album-detail-copy');
  copy.append(el('p', 'detail-kicker', 'Album World'));
  copy.append(el('h2', '', album.title));
  copy.append(el('p', 'detail-intro', album.caption));

  const sectionList = el('div', 'album-sections');
  album.sections.forEach((section) => sectionList.append(el('span', '', section)));
  copy.append(sectionList);
  copy.append(el('p', 'detail-intro', 'Diese erste Ebene ist vorbereitet. Musik, Geschichte, Idee, Merchandise und Vinyl können im nächsten Schritt als eigene Räume innerhalb dieser Album-Welt ausgebaut werden.'));

  detail.append(visual, copy);
  openPanel(detail);
}

function openMemories() {
  const detail = el('article', 'memory-detail');
  const visual = el('div', 'memory-detail-visual');
  const img = document.createElement('img');
  img.src = memories.image;
  img.alt = 'Portrait — memory archive reference';
  visual.append(img);

  const copy = el('div', 'memory-detail-copy');
  copy.append(el('p', 'detail-kicker', 'Archive'));
  copy.append(el('h2', '', memories.title));
  copy.append(el('p', 'detail-intro', memories.intro));
  copy.append(el('p', 'detail-intro', 'Hier entsteht kein klassischer Blog, sondern ein Archiv aus Fotos, Textfragmenten, Hintergründen und persönlichen Erinnerungen.'));

  detail.append(visual, copy);
  openPanel(detail);
}

function openChannels() {
  const detail = el('article', 'channels-detail');
  detail.append(el('p', 'detail-kicker', 'Outside'));
  detail.append(el('h2', '', 'Channels'));
  detail.append(el('p', 'detail-intro', 'Die Tür führt zu den Plattformen außerhalb der Deep-Structure-Welt. Die Zieladressen sind in einer zentralen Datenstruktur vorbereitet und können später einfach ersetzt werden.'));

  const grid = el('div', 'channels-grid');
  const status = el('p', 'channel-note', 'Prototype: platform URLs are still placeholders.');

  channels.forEach((channel) => {
    const link = document.createElement('a');
    link.className = 'channel-link';
    link.href = channel.url;
    link.append(el('span', 'channel-mark', channel.mark), el('span', '', channel.label));

    if (channel.url !== '#') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        status.textContent = `${channel.label}: Link noch nicht eingetragen.`;
      });
    }
    grid.append(link);
  });

  detail.append(grid, status);
  openPanel(detail);
}

function onPointerMove(event) {
  if (!active || reducedMotion) return;
  pointerNX = (event.clientX / innerWidth - .5) * 2;
  pointerNY = (event.clientY / innerHeight - .5) * 2;
}

function animate(now) {
  if (active && !reducedMotion) {
    smoothX += (pointerNX - smoothX) * .055;
    smoothY += (pointerNY - smoothY) * .055;
    world.style.setProperty('--world-x', `${(-smoothX * 7).toFixed(2)}px`);
    world.style.setProperty('--world-y', `${(-smoothY * 5).toFixed(2)}px`);

    const t = now * .001;
    interactiveObjects.forEach((node) => {
      const depth = Number(node.dataset.depth || .5);
      const phase = Number(node.dataset.phase || 0);
      const floatY = Math.sin(t * (.55 + depth * .18) + phase) * (2.4 + depth * 2.8);
      const floatX = Math.cos(t * .37 + phase) * 1.5;
      node.style.setProperty('--local-x', `${(smoothX * depth * 8 + floatX).toFixed(2)}px`);
      node.style.setProperty('--local-y', `${(smoothY * depth * 5 + floatY).toFixed(2)}px`);
      node.style.setProperty('--tilt-x', `${(-smoothY * depth * 1.7).toFixed(2)}deg`);
      node.style.setProperty('--tilt-y', `${(smoothX * depth * 2.2).toFixed(2)}deg`);
    });
  }
  requestAnimationFrame(animate);
}

indexButton.addEventListener('click', () => indexPanel.classList.toggle('is-open'));
panelClose.addEventListener('click', closePanel);
panel.addEventListener('click', (event) => {
  if (event.target === panel) closePanel();
});

addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (panelOpen) closePanel();
  else indexPanel.classList.remove('is-open');
});

addEventListener('pointermove', onPointerMove, { passive: true });
mobileQuery.addEventListener?.('change', applyLayout);

addEventListener('deepstructure:entered', () => {
  active = true;
  world.classList.add('is-ready');
});

if (location.hash === '#inside' || document.body.classList.contains('entered')) {
  active = true;
  world.classList.add('is-ready');
}

renderWorld();
requestAnimationFrame(animate);
