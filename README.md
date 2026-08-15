# Deep Structure — Landing Page Prototype

Experimental single-screen entrance for the Deep Structure website.

## Current prototype

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

The original bitmap logo is no longer used as the visible entrance object. The current symbol is generated from 3D geometry at runtime.

## Runtime dependency

The prototype imports Three.js as an ES module from unpkg. No framework or build process is required for the current GitHub Pages version.

## Files

- `index.html` — semantic scene shell and transition UI
- `styles.css` — composition, typography, cursor and visual layers
- `app.js` — WebGL water shader, Three.js symbol and interaction logic
- `CODEX_TASK.md` — canonical design/technical specification for further Codex work
- `assets/deep-structure-logo.webp` — legacy/reference asset only

## Local preview

Because `app.js` is an ES module, preview through a small local web server rather than opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Future hand-off

The entrance transition dispatches `deepstructure:entered` and sets the URL hash to `#inside`. That remains the hand-off point for the future interior website/navigation.
