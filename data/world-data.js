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

// open: false zeigt „Im Aufbau“. Sobald der Shopify-Shop ohne Passwort erreichbar ist, auf true stellen.
export const shop = {
  title: 'Deep Structure Webshop',
  url: 'https://yhzrzs-j1.myshopify.com/',
  open: false
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

// Das Bild in der Mitte der Vinyl in der Welt (steht für alle Platten).
export const vinylShelf = {
  label: './assets/albums/deep-space-label.webp',
  caption: 'Deep Structure auf Platte'
};

// Apps & Spiele: das Teaser-Video oben und die Projekte darunter.
export const projectsTeaser = {
  title: 'Clash of the Universe · Teaser',
  src: './assets/games/clash-shadow-teaser.mp4',
  poster: './assets/projects/clash-title.webp'
};

export const projects = [
  {
    id: 'clash',
    title: 'Clash of the Universe',
    status: 'Spiel · in Entwicklung',
    text: 'Sci-Fi-Tower-Defense fürs Handy, gezeichnet im Comic-Stil. Ein Spiel, zwei Seiten der Galaxie: Halte die Basis gegen die anrückenden Maschinen von Shadow of the Universe.',
    images: [
      { src: './assets/projects/clash-title.webp', alt: 'Titelbild Clash of the Universe und Shadow of the Universe' },
      { src: './assets/projects/clash-helden.webp', alt: 'Die vier Helden: Kommandant, Technikerin, Schwerer und Aufklärerin' },
      { src: './assets/projects/clash-anlagen.webp', alt: 'Anlagen und Fahrzeuge der Basis' }
    ]
  },
  {
    id: 'monsterjaeger',
    title: 'Monsterjäger – Das Land der Seuche',
    status: 'Spiel · Demo-Version jetzt spielbar',
    text: 'Aufbau- und Strategiespiel im Comic-Stil: Baue Grauweiler auf, verbinde Holzfäller, Mühle, Bäckerei und Schmiede zu Warenketten und führe den Monsterjäger mit deiner Miliz gegen die Seuchennester der Nachbardörfer. Die Musik von Deep Structure ist die Uhr des Spiels: Ein Tag dauert genau so lange wie seine sechs Stücke – jeder Tag ist anders lang. Tagsüber versperrt eine Dornenhecke die verseuchten Dörfer, erst nachts öffnet sie sich – für die Kreaturen und für deine Kämpfer. Die Demo umfasst das Tutorial und die Befreiung von Mooskirchen. Läuft direkt im Browser, am besten am Computer mit Maus, Tastatur und Ton.',
    play: {
      label: 'Demo spielen',
      src: './spiele/monsterjaeger/?v=277c13ed',
      title: 'Monsterjäger · Demo-Version'
    },
    images: [
      { src: './assets/projects/monsterjaeger-demo-dorf.webp', alt: 'Spielszene aus der Demo: das Dorf Grauweiler mit Mühle, Wirtshaus und Dorfbewohnern' },
      { src: './assets/projects/monsterjaeger-demo-soldaten.webp', alt: 'Spielszene aus der Demo in Nahansicht: Milizwachen, Speerträger, Bogenschütze, Schwertkämpfer und Hauptmann' },
      { src: './assets/projects/monsterjaeger-demo-kreaturen.webp', alt: 'Spielszene aus der Demo: Zombies, Ghule, Seuchenhunde und eine Brut am Rand von Grauweiler' },
      { src: './assets/projects/monsterjaeger-demo-kampf.webp', alt: 'Spielszene aus der Demo: der Monsterjäger und seine Miliz kämpfen im verseuchten Mooskirchen zwischen den Seuchennestern' },
      { src: './assets/projects/monsterjaeger-demo-titel.webp', alt: 'Titelbild der Demo-Version von Monsterjäger' },
      { src: './assets/projects/monsterjaeger-held.webp', alt: 'Figurenblatt des Monsterjägers mit Ausrüstung und Farbpalette' }
    ]
  },
  {
    id: 'studio',
    title: 'Deep Structure Mastering Studio',
    status: 'In Entwicklung · Beta-Test',
    text: 'Mastering direkt im Browser: Song-Check, Reparatur typischer KI-Artefakte, Equalizer, Kompressor, Limiter und Export als WAV, MP3 oder OGG. Alles läuft auf deinem Gerät. Noch in Entwicklung – Updates und Beta-Zugang per E-Mail.',
    link: { label: 'Mehr erfahren', href: './studio/' },
    images: [
      { src: './assets/projects/studio.webp', alt: 'Oberfläche des Deep Structure Mastering Studio' }
    ]
  },
  {
    id: 'trading',
    title: 'Private AI Trading Bot',
    status: 'App · privat, in Entwicklung',
    text: 'Eine eigene Desktop-App, in der mehrere KI-Agenten Märkte beobachten und Risiken prüfen. Sie läuft lokal, und jeder Trade braucht eine Freigabe von Hand.',
    images: [
      { src: './assets/projects/trading-bot.webp', alt: 'Übersicht der Trading-App mit Kursverlauf und Agenten' }
    ]
  }
];

// Bilder, die auf den Karten in der Welt durchlaufen.
export const projectDeck = [
  './assets/projects/thumb-clash-title.webp',
  './assets/projects/thumb-monsterjaeger-held.webp',
  './assets/projects/thumb-clash-helden.webp',
  './assets/projects/thumb-studio.webp',
  './assets/projects/thumb-monsterjaeger-demo.webp',
  './assets/projects/thumb-clash-anlagen.webp',
  './assets/projects/thumb-trading-bot.webp'
];
