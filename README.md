# Deep Structure — Landing Page Prototype

Experimental single-screen entrance for the Deep Structure website.

## Included
- Full-screen dark liquid/WebGL surface
- Pointer-reactive ripple field
- Custom compass cursor on desktop
- Deep Structure logo as the only entry object
- Click/tap transition with “The World you get in.”
- Responsive behavior for desktop and touch devices
- Reduced-motion fallback
- No third-party runtime dependencies

## Local preview
Run a small local server in this directory:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Next step
The transition fires `deepstructure:entered` and sets `#inside`. That is the hand-off point for the future inner website.
