// Only released physical records belong in this collection.
export const vinylReleases = [{
  id: 'forest',
  title: 'The Forest Does Not Forget',
  published: true,
  image: './assets/albums/the-forest-does-not-forget.jpg',
  labelImage: './assets/albums/the-forest-does-not-forget-label.png',
  caption: 'Dunkle Folklore trifft auf Drum & Bass. Märchen, Erinnerung und Schatten — auf Vinyl, mit eigenem Booklet.',
  features: ['12″ Vinyl + Booklet', 'Limited Edition', '12 Tracks · 42 Minuten'],
  purchaseUrl: 'https://elasticstage.com/deep-structure/releases/the-forest-does-not-forget-album'
}];

export const shop = {
  title: 'Deep Structure Webshop',
  url: 'https://yhzrzs-j1.myshopify.com/'
};

export const channels = [
  {
    id: 'spotify',
    label: 'Spotify',
    mark: 'SP',
    url: 'https://open.spotify.com/intl-de/artist/7D3ibrgZdvhQDorWcjcR8T'
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    mark: 'SC',
    url: 'https://soundcloud.com/deepstructure-269845164'
  },
  {
    id: 'youtube',
    label: 'YouTube',
    mark: 'YT',
    url: 'https://www.youtube.com/channel/UCXFT31NeGwDTmFq6G8YT84g'
  },
  {
    id: 'youtube-2',
    label: 'YouTube — Deep Structure',
    mark: 'Y2',
    url: 'https://www.youtube.com/@DeepStructure-k8u'
  },
  {
    id: 'bandcamp',
    label: 'Bandcamp',
    mark: 'BC',
    url: 'https://deepstructures.bandcamp.com/'
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    mark: 'TT',
    url: 'https://www.tiktok.com/@deep.structure'
  },
  {
    id: 'amazon-music',
    label: 'Amazon Music',
    mark: 'AM',
    url: 'https://music.amazon.de/artists/B0H6SPJ4P1'
  },
];

// Public listener endpoints; no administration credentials belong in this file.
export const radio = {
  id: 'radio',
  title: 'Deep Structure Radio',
  caption: 'Dunkle Märchen, Tragödien und Drum & Bass. Jede Geschichte läuft Kapitel für Kapitel.',
  streamUrl: 'https://a10.asurahosting.com:9170/radio.mp3',
  metadataUrl: 'https://a10.asurahosting.com/api/nowplaying/deep_structure_radio',
  playerUrl: 'https://a10.asurahosting.com/public/deep_structure_radio',
  stationLabel: 'DEEP STRUCTURE RADIO',
  nowPlayingFallback: 'Deep Structure — Geschichten in ihrer Reihenfolge',
  tunerMark: 'DS'
};
