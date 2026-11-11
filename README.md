# Deep Structure — Website

Website von Deep Structure auf [deepstructure.world](https://deepstructure.world/) (GitHub Pages).
Reines HTML, CSS und JavaScript als ES-Module, ohne Build-Schritt.

## Ablauf

1. **Startseite:** Das Deep-Structure-Logo schwebt in 3D über dunklem Wasser. Die Ringe drehen sich
   waagrecht um das Dreieck (wie eine Armillarsphäre). Beim Klick taucht das Logo ein, und die Wellen
   laufen hinter „The World you step into.“ aus.
2. **Welt:** Nach dem Eintreten (Adresse `#inside`) stehen vier Objekte im Wald:
   - **Musik:** Bassbox mit Signalring, öffnet das Deep Structure Radio (Live-Stream über Asura Hosting).
   - **Vinyl:** Platte mit Deep-Space-Label; elasticStage-Link zur veröffentlichten Vinyl.
   - **Apps & Spiele:** Kartenstapel; öffnet Teaser-Video, Clash of the Universe, Monsterjäger,
     Mastering Studio (`/studio/`) und den Private AI Trading Bot. „Demo spielen“ bei Monsterjäger
     öffnet die Browser-Demo (`/spiele/monsterjaeger/`) in einem eigenen Fenster über der Welt.
   - **Webshop:** Vitrine mit wechselnden Produkten. Solange `shop.open` in `data/world-data.js`
     auf `false` steht, zeigt sie „Im Aufbau“ und verweist auf die Vinyl.
3. **Hintergrundmusik:** Lautsprecher-Knopf unten rechts. Vier Klavierstücke im Loop, leise.
   Pausiert, solange Radio oder ein Video läuft.

Neu laden beginnt immer wieder bei der Startseite. Direkt in die Welt geht es nur bei der Rückkehr
von Impressum oder Datenschutz innerhalb von 30 Minuten.

## Wichtige Dateien

- `index.html`: Startseite, Übergang und Welt-Grundgerüst; Meta- und Vorschau-Angaben (Open Graph)
- `landing-3d.js` / `landing-3d.css`: 3D-Startseite (Three.js, WebGL2). Ohne WebGL2 übernehmen
  `symbol-v2.js` und der Wasser-Shader in `app.js`.
- `app.js`: Wasser-Shader und Eintritt; setzt `#inside` und löst `deepstructure:entered` aus
- `world.js`: Objekte, Navigation, Fenster (Radio, Vinyl, Apps & Spiele, Webshop), Radio-Steuerung
- `data/world-data.js`: Inhalte und Links (Vinyl, Shop, Kanäle, Radio, Projekte)
- `music.js` / `music.css`: Hintergrundmusik, Medientasten, Anzeige „On Air · Stop“ für das Radio
- `fonts.css`: selbst gehostete Schriften (Cormorant Garamond, Inter; OFL-Lizenzen in `assets/fonts/`)
  und Farb-/Bewegungs-Tokens
- `polish.css`: Schrift, Farben, Fenster und Knöpfe der Welt (wird nach den Grund-Stylesheets geladen)
- `speaker.css`, `projects.css`, `shop.css`: Bassbox, Kartenstapel und Projekt-Ansicht, Vitrine
- `styles.css`, `world.css`, `radio.css`, `story-world.css`: Grundlayout von Startseite und Welt
- `studio/`: Deep Structure Mastering Studio (eigene Web-App)
- `spiele/monsterjaeger/`: Demo-Version von Monsterjäger. Fertig gebaut (ein unlesbar gemachtes
  Skript `mj.js`, WebP-Grafiken, lokale Schriften) – hier nichts von Hand ändern, sondern im Spielordner
  `python3 tools/build_web.py <Ziel>` ausführen und den Ordner ersetzen. In `data/world-data.js`
  steht beim Projekt der Eintrag `play`, der den Knopf „Demo spielen“ erzeugt.
- `impressum.html`, `datenschutz.html`, `legal.css`: Rechtliches
- `manifest.webmanifest`, `favicon.ico`, `assets/icons/`: App-Symbol für Startbildschirm und Browser
- `robots.txt`, `sitemap.xml`: für Suchmaschinen

Three.js liegt lokal unter `assets/vendor/three/`; es werden keine Skripte von fremden Servern geladen.

## Lokale Vorschau

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Shop freischalten

Sobald der Shopify-Shop ohne Passwort erreichbar ist:

1. In `data/world-data.js` `open: true` setzen.
2. In `impressum.html` den auskommentierten Link zum Kontaktformular wieder einblenden.
