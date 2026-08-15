import { theaterImage } from './assets/theater.js';
import { kintsugiImage } from './assets/kintsugi.js';
import { faustImage } from './assets/faust.js';
import { itWorksImage } from './assets/it-works.js';
import { redShoesImage } from './assets/red-shoes.js';
import { portraitImage } from './assets/portrait.js';

export const albums = [
  {
    id: 'theater',
    title: 'Das Theater der Wirklichkeit',
    image: theaterImage,
    tone: 'theater',
    caption: 'Bühne, Maske, Wahrnehmung und Wirklichkeit.',
    sections: ['Music', 'Story / Concept', 'Idea', 'Merchandise', 'Vinyl / Elastic Stage']
  },
  {
    id: 'kintsugi',
    title: 'Kintsugi',
    image: kintsugiImage,
    tone: 'kintsugi',
    caption: 'Bruch, Gold, Heilung und das Sichtbarbleiben der Geschichte.',
    sections: ['Music', 'Story / Concept', 'Idea', 'Merchandise', 'Vinyl / Elastic Stage']
  },
  {
    id: 'faust',
    title: 'Faust – The Deep Structure Deception',
    image: faustImage,
    tone: 'faust',
    caption: 'Täuschung, Daten, Kontrolle und die Struktur hinter dem System.',
    sections: ['Music', 'Story / Concept', 'Idea', 'Merchandise', 'Vinyl / Elastic Stage']
  },
  {
    id: 'it-works',
    title: 'It Works',
    image: itWorksImage,
    tone: 'itworks',
    caption: 'Post-Punk, Zerfall, Reibung und die Frage, was tatsächlich funktioniert.',
    sections: ['Music', 'Story / Concept', 'Idea', 'Merchandise', 'Vinyl / Elastic Stage']
  },
  {
    id: 'red-shoes',
    title: 'Die roten Schuhe',
    image: redShoesImage,
    tone: 'redshoes',
    caption: 'Märchen, Zwang, Verführung und Kontrollverlust.',
    sections: ['Music', 'Story / Concept', 'Idea', 'Merchandise', 'Vinyl / Elastic Stage']
  }
];

export const memories = {
  title: 'Memories',
  image: portraitImage,
  intro: 'Erinnerungen, persönliche Hintergründe, Fragmente und Geschichten hinter Deep Structure.'
};

export const channels = [
  { id: 'soundcloud', label: 'SoundCloud', mark: 'SC', url: '#' },
  { id: 'spotify', label: 'Spotify', mark: 'SP', url: '#' },
  { id: 'amazon-music', label: 'Amazon Music', mark: 'AM', url: '#' },
  { id: 'youtube', label: 'YouTube', mark: 'YT', url: '#' },
  { id: 'youtube-music', label: 'YouTube Music', mark: 'YM', url: '#' },
  { id: 'apple-music', label: 'Apple Music / iTunes', mark: 'AP', url: '#' },
  { id: 'tiktok', label: 'TikTok', mark: 'TT', url: '#' },
  { id: 'bandcamp', label: 'Bandcamp', mark: 'BC', url: '#' }
];

// 24/7 stream configuration. Add the future AzuraCast/Icecast stream URL here.
export const radio = {
  id: 'radio',
  title: 'Deep Structure Radio',
  caption: '24/7 Deep Structure — the catalogue as a continuous signal.',
  streamUrl: '',
  metadataUrl: '',
  stationLabel: 'DEEP STRUCTURE RADIO',
  nowPlayingFallback: 'Continuous transmission',
  tunerMark: 'DS'
};
