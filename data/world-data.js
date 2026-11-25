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
    title: 'Monsterjäger I – Der Ursprung',
    status: 'Spiel · Serie, Teil I · Demo jetzt spielbar',
    // Monsterjäger ist als Serie aus vier Spielen angelegt: Teil I spielbar, II bis IV in Planung
    series: {
      name: 'Monsterjäger',
      complete: true,
      parts: [
        { label: 'Teil I', title: 'Der Ursprung', genre: 'Aufbau und Überleben', state: 'Demo spielbar', current: true },
        { label: 'Teil II', title: 'Der Verfluchte', genre: 'Aufbau und Tower Defense', state: 'in Planung' },
        { label: 'Teil III', title: 'Das Vermächtnis', genre: 'Aufbau und Assassinen-Missionen', state: 'in Planung' },
        { label: 'Teil IV', title: 'Die Erlösung', genre: 'Hack and Slash', state: 'in Planung' }
      ]
    },
    text: 'Aufbau, Strategie und Gruftkämpfe im Comic-Stil. Eine Seuche sucht das Land heim: Die Toten stehen wieder auf, und jede Nacht läutet in Nebelstein die Totenglocke. Elias, ein Jäger aus Grauweiler, wird gebissen – und überlebt als Einziger. Tagsüber baust du sein Dorf wieder auf, verbindest Holzfäller, Mühle, Bäckerei und Schmiede zu Warenketten und ziehst mit deiner Miliz gegen die Seuchennester der Nachbardörfer. Nachts hältst du stand, während die Dornenhecken sich öffnen. Fällt das letzte Nest, erhebt sich vor der entweihten Dorfkirche ihr Hüter: Moorleiche, Flussgeist, Krähenhexe, Knochenfürst und Feuerdämon. Unter jeder Kirche wartet eine Gruft – dort kämpfst du direkt, mit Schwester Ilse, Bruno oder der Jägerin an deiner Seite, und findest die Reliquien und die Briefe Severins, des Hirten der Toten. Die Musik von Deep Structure ist die Uhr des Spiels: Ein Tag dauert genau so lange wie seine sechs Stücke. Läuft direkt im Browser, am besten am Computer mit Maus, Tastatur und Ton.',
    seriesNote: 'Der Ursprung erzählt, wie Elias zum Monsterjäger wurde – und woher sein Fluch stammt. Vier Spiele führen seine Geschichte weiter, jedes mit eigenem Schwerpunkt und eigener Musik: vom Aufbauspiel bis zum reinen Hack and Slash. Die Welt bleibt mittelalterlich, Severin und der Orden vom Schwarzen Siegel bleiben Elias auf den Fersen.',
    play: {
      label: 'Demo spielen',
      src: './spiele/monsterjaeger/?v=cabdef0d',
      title: 'Monsterjäger · Demo-Version'
    },
    trailer: {
      src: './assets/games/monsterjaeger-trailer.mp4',
      poster: './assets/games/monsterjaeger-trailer.jpg',
      label: 'Gameplay-Trailer zu Monsterjäger I – Der Ursprung'
    },
    images: [
      { src: './assets/projects/monsterjaeger-boss-moorleiche.webp', alt: 'Spielszene: Elias und seine Miliz kämpfen vor der entweihten Friedhofskirche von Mooskirchen gegen die Moorleiche' },
      { src: './assets/projects/monsterjaeger-gruft-begleiter.webp', alt: 'Spielszene in der Gruft unter der Holzkirche von Krähenfeld: Elias mit seinen Begleitern gegen Skelette' },
      { src: './assets/projects/monsterjaeger-boss-feuerdaemon.webp', alt: 'Spielszene: Der Feuerdämon speit vor der ausgebrannten Kirche von Aschenhain Feuer auf Elias' },
      { src: './assets/projects/monsterjaeger-gruft-reliquie.webp', alt: 'Spielszene: Die Reliquienkammer der überfluteten Gruft von Schwarzbach mit dem Kelch auf dem Altar und dem Gruftwächter' },
      { src: './assets/projects/monsterjaeger-boss-kraehenhexe.webp', alt: 'Spielszene: Die Krähenhexe in Krähenfeld mit ihrem Krähenschwarm – „Er sieht dich, Jäger.“' },
      { src: './assets/projects/monsterjaeger-kirche-totenau.webp', alt: 'Spielszene: Die gereinigte Beinhauskirche von Totenau, der Abstieg in die Gruft liegt offen' },
      { src: './assets/projects/monsterjaeger-abstieg-totenau.webp', alt: 'Ladebild beim Abstieg in das Beinhaus von Totenau: Elias mit der Laterne auf der Treppe' },
      { src: './assets/projects/monsterjaeger-brief-severin.webp', alt: 'Ein Brief Severins an den Orden vom Schwarzen Siegel, gefunden in der Gruft von Schwarzbach' },
      { src: './assets/projects/monsterjaeger-demo-dorf.webp', alt: 'Spielszene: das Dorf Grauweiler mit Mühle, Wirtshaus und Dorfbewohnern' },
      { src: './assets/projects/monsterjaeger-demo-kampf.webp', alt: 'Spielszene: Elias und seine Miliz kämpfen im verseuchten Mooskirchen zwischen den Seuchennestern' },
      { src: './assets/projects/monsterjaeger-demo-soldaten.webp', alt: 'Spielszene in Nahansicht: Milizwachen, Speerträger, Bogenschütze, Schwertkämpfer und Hauptmann' },
      { src: './assets/projects/monsterjaeger-demo-kreaturen.webp', alt: 'Spielszene: Zombies, Ghule, Seuchenhunde und eine Brut am Rand von Grauweiler' },
      { src: './assets/projects/monsterjaeger-demo-titel.webp', alt: 'Titelbild von Monsterjäger – Das Land der Seuche' },
      { src: './assets/projects/monsterjaeger-held.webp', alt: 'Figurenblatt von Elias, dem Jäger, mit Ausrüstung und Farbpalette' }
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
  './assets/projects/thumb-monsterjaeger-boss.webp',
  './assets/projects/thumb-clash-anlagen.webp',
  './assets/projects/thumb-trading-bot.webp'
];

/* Comics: kostenlos zum Herunterladen.
   Neuer Comic = PDF (und optional CBZ) nach assets/comics/, Cover dazu, dann hier einen Eintrag ergänzen.
   Beispiel:
   {
     id: 'monsterjaeger-01',
     series: 'Monsterjäger',
     number: 1,
     title: 'Titel der Geschichte',
     text: 'Worum es geht, in zwei, drei Sätzen.',
     cover: './assets/comics/monsterjaeger-01-cover.webp',
     pages: 24,
     files: [
       { format: 'PDF', href: './assets/comics/monsterjaeger-01.pdf', size: '18 MB' },
       { format: 'CBZ', href: './assets/comics/monsterjaeger-01.cbz', size: '20 MB' }
     ],
     shopUrl: ''   // später: Link zum Kauf, falls der Comic nicht gratis ist
   }
   Neueste Ausgabe zuerst eintragen. Bitte auch die Seite comics/index.html ergänzen (für Google). */
export const comics = [];

export const comicsShelf = {
  caption: 'Geschichten aus der Welt von Deep Structure',
  intro: 'Comics aus der Welt von Deep Structure: die Geschichten hinter Monsterjäger – Elias’ Vergangenheit, der Orden vom Schwarzen Siegel und die Mächte, die im Hintergrund wirken – und weitere kurze Geschichten. Kostenlos zum Herunterladen.',
  // Cover für den Comicstapel in der Welt, solange es noch keine eigenen Cover gibt
  covers: [
    './assets/projects/monsterjaeger-abstieg-totenau.webp',
    './assets/projects/monsterjaeger-boss-kraehenhexe.webp',
    './assets/projects/monsterjaeger-brief-severin.webp'
  ]
};

/* Videos: die Bibliothek aller Videos von Deep Structure (Fernseher in der Welt und Seite /videos/).
   Neuestes Video zuerst eintragen. Gruppen: 'musik' (Musikvideos) oder 'trailer' (Trailer & Teaser).
   - Eigene Datei: MP4 nach assets/videos/ (am besten unter 50 MB, H.264, 720p oder 1080p),
     Vorschaubild als WebP daneben, dann `src` und `poster` eintragen. Das Video läuft direkt hier.
   - Video, das nur auf YouTube oder TikTok liegt: statt `src` einfach `url` eintragen (plus `poster`).
     Dann öffnet die Karte das Video auf der jeweiligen Plattform in einem neuen Tab.
   Bitte auch die Seite videos/index.html ergänzen (für Google). */
export const videos = [
  {
    id: 'rumpelstilzchen-c64',
    group: 'musik',
    title: 'Rumpelstilzchen – Feuerkreis',
    kind: 'Musikvideo · C64-Pixel-Look',
    duration: '4:30',
    text: 'Das Grimm-Märchen erzählt wie ein Commodore-64-Spiel aus den 80ern: vom Ladebildschirm über drei Nächte am Spinnrad bis zum Tanz im Feuerkreis. 320 × 200 Pixel, 16 Farben, jede Szene auf den Beat geschnitten.',
    src: './assets/videos/rumpelstilzchen-feuerkreis-c64.mp4',
    poster: './assets/videos/rumpelstilzchen-feuerkreis-c64.webp'
  },
  {
    id: 'rumpelstilzchen-liedtext',
    group: 'musik',
    title: 'Rumpelstilzchen – Feuerkreis',
    kind: 'Musikvideo mit Liedtext',
    duration: '4:20',
    text: 'Die gemalte Fassung zum Mitlesen: Im Wald brodelt der Kessel, und Rumpelstilzchen tanzt ums Feuer. Ein dunkles Märchen zwischen Drum & Bass und 16-Bit.',
    src: './assets/videos/rumpelstilzchen-feuerkreis-liedtext.mp4',
    poster: './assets/videos/rumpelstilzchen-feuerkreis-liedtext.webp'
  },
  {
    id: 'monsterjaeger-trailer',
    group: 'trailer',
    title: 'Monsterjäger I – Der Ursprung',
    kind: 'Gameplay-Trailer',
    duration: '0:43',
    text: 'Aufbau bei Tag, Abwehr bei Nacht und Kämpfe in den Grüften: der erste Blick auf das Spiel, mit Musik von Deep Structure.',
    src: './assets/games/monsterjaeger-trailer.mp4',
    poster: './assets/games/monsterjaeger-trailer.jpg'
  },
  {
    id: 'clash-teaser',
    group: 'trailer',
    title: 'Clash of the Universe',
    kind: 'Teaser',
    duration: '2:00',
    text: 'Sci-Fi-Tower-Defense im Comic-Stil: die Basis gegen die Maschinen von Shadow of the Universe.',
    src: './assets/games/clash-shadow-teaser.mp4',
    poster: './assets/projects/clash-title.webp'
  },
  {
    id: 'games-pitch',
    group: 'trailer',
    title: 'Deep Structure Games',
    kind: 'Pitch-Video',
    duration: '0:10',
    text: 'Das Logo-Intro der Spiele von Deep Structure: Das Zeichen erwacht.',
    src: './assets/games/deep-structure-games-pitch.mp4',
    poster: './assets/videos/deep-structure-games-pitch.webp'
  }
];

export const videoGroups = [
  { id: 'musik', title: 'Musikvideos' },
  { id: 'trailer', title: 'Trailer & Teaser' }
];

export const videoShelf = {
  caption: 'Musikvideos · Trailer · Clips',
  intro: 'Alle Videos von Deep Structure an einem Ort: Musikvideos zu den Märchen und Geschichten, dazu Trailer und Teaser zu den Spielen.'
};
