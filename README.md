# Deep Structure — Interactive World Prototype

Experimental entrance and first interior world for the Deep Structure website.

## Entrance

- Full-screen dark liquid/WebGL surface
- Persistent object-centered displacement and ripple field
- Pointer-reactive water ripples
- Custom compass cursor on desktop
- Procedurally reconstructed Three.js Deep Structure symbol
- Metallic 3D lighting, depth, idle float and cursor-driven tilt
- Separate HTML/CSS `DEEP STRUCTURE` wordmark
- Click/tap transition with **“The World you get in.”**
- Responsive behavior for desktop and touch devices
- Reduced-motion fallback

## Deep Structure World V1

After the entrance transition, the visitor enters a dark spatial navigation scene rather than a conventional menu.

Current world objects:

- 5 floating vinyl records — entrances to album worlds
  - Das Theater der Wirklichkeit
  - Kintsugi
  - Faust – The Deep Structure Deception
  - It Works
  - Die roten Schuhe
- 1 suspended archival photo — entrance to Memories
- 1 floating door — entrance to Channels
- subtle pointer parallax and object float
- restrained hover responses
- minimal `INDEX` fallback navigation
- first-level detail overlays for albums, Memories and Channels
- mobile layout and reduced-motion handling

Album covers are used only as compact vinyl-label/detail references, not as flat billboards in the main world.

## Channels

The Channels view is prepared for:

- SoundCloud
- Spotify
- Amazon Music
- YouTube
- YouTube Music
- Apple Music / iTunes
- TikTok
- Bandcamp

URLs are currently placeholders in `data/world-data.js`. Real external URLs will open in a new tab once entered.

## Runtime dependency

The prototype imports Three.js as an ES module from unpkg. No framework or build process is required for the current GitHub Pages version.

## Main files

- `index.html` — entrance shell, transition and World V1 host markup
- `styles.css` — entrance composition, symbol stage and compass
- `app.js` — WebGL water shader and entrance interaction
- `symbol-v2.js` — corrected procedural 3D Deep Structure symbol
- `world.css` — interior world, vinyl/photo/door objects and detail panels
- `world.js` — World V1 rendering, navigation, parallax and overlays
- `data/world-data.js` — albums, memories and channel configuration
- `data/assets/*.js` — compact embedded WebP references supplied for this prototype
- `CODEX_TASK.md` — design/technical specification for further Codex work

## Local preview

Preview through a small local web server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Event hand-off

The entrance transition dispatches `deepstructure:entered` and sets the URL hash to `#inside`. `world.js` listens for that event and activates the interior scene.
