# Deep Structure Landing Page — Codex Working Specification

## 1. Precise Codex prompt

Work on the existing `deep-structure-website` repository. Preserve the minimal, dark Deep Structure entrance concept, but treat the landing page as an interactive spatial scene rather than a conventional website hero.

### Primary objective

Build the Deep Structure mark as a real procedural 3D metallic object with Three.js. Do **not** use the square logo artwork as the visible landing-page object. Reconstruct the visual language from geometry: concentric metallic rings, the central triangular form, and the lower curved element. Render the wordmark `DEEP STRUCTURE` separately as real HTML/CSS typography.

The object must appear to float partially on or immediately above a nearly black liquid surface. The water has permanent slow movement and must visibly react to both the object and the compass cursor. The object's apparent mass should create a darker displaced basin plus concentric waves. When the cursor approaches or moves across the symbol, increase local ripples, subtly lift and tilt the object toward the pointer, shift specular highlights, and strengthen the water reflection. Motion must have inertia and should feel heavy, controlled, and physical rather than playful.

### Visual direction

- black / near-black environment
- cold cyan and silver highlights only
- restrained metallic reflections
- no bright blue gaming aesthetic
- no card, panel, rectangle, image frame, or visible bitmap boundary around the symbol
- slow, high-quality motion
- the symbol should read as a sculptural object with depth and mass
- typography remains secondary to the symbol

### Interaction

- Desktop cursor is a custom compass.
- Cursor movement creates visible local water ripples.
- Proximity to the 3D symbol increases displacement/ripple intensity.
- The symbol tilts on X/Y with smooth damping, shifts slightly in X/Y/Z, and idles with subtle floating motion.
- Clicking/tapping the entrance runs the existing transition containing `The World you get in.`
- After the transition, dispatch `deepstructure:entered` and set `#inside` as the hand-off for the future site.

### Technical constraints

- Static-site compatible with GitHub Pages.
- No framework/build process required for this landing-page prototype.
- Use Three.js as an ES module.
- Keep the existing custom WebGL water shader approach.
- The visible 3D symbol must be procedural geometry, not a logo image or texture.
- Respect `prefers-reduced-motion`.
- Keep touch/mobile usable; hide the custom compass on coarse pointers.
- Cap device pixel ratio to avoid unnecessary GPU load.
- Keep the code readable for subsequent Codex iterations.

### Acceptance criteria

1. No square/rectangular logo image is visible on the landing page.
2. The symbol is rendered by Three.js geometry and changes perspective when the pointer moves near it.
3. The water has clearly perceptible continuous motion even when the pointer is stationary.
4. The object's location visibly produces a displaced/darker water basin and expanding wave structure.
5. Cursor movement produces additional local ripples.
6. `DEEP STRUCTURE` is separate selectable/layout typography, not baked into an image.
7. Clicking the entrance still displays `The World you get in.` before entering.
8. The page remains responsive and GitHub Pages compatible.

## 2. File structure

```text
deep-structure-website/
├── index.html          # semantic scene shell and transition UI
├── styles.css          # layout, typography, compass, reflections, transition
├── app.js              # water WebGL shader + Three.js symbol + interaction
├── CODEX_TASK.md       # this specification
├── README.md
└── assets/
    └── deep-structure-logo.webp  # legacy/reference asset only; not used by the landing object
```

## 3. Responsibility by file

### `index.html`

Keep HTML intentionally small. It contains:

- background water canvas `#fluid`
- depth vignette and subtle grain layers
- one interactive entrance button
- empty `#symbolStage`, filled at runtime by Three.js
- separate `DEEP STRUCTURE` wordmark
- transition overlay and text
- compass cursor markup

The page loads `app.js` with `type="module"`.

### `styles.css`

Responsible for:

- full-screen black composition
- depth/vignette/noise overlays
- 3D stage placement and responsive sizing
- CSS water contact shadow/reflection support
- metallic wordmark treatment
- compass cursor
- entrance transition
- mobile and reduced-motion behavior

It must never recreate a visible rectangular artwork panel around the symbol.

### `app.js`

Contains two rendering systems:

#### Water system

A full-screen WebGL fragment shader that combines:

- fractal noise / broad water movement
- moving surface bands
- permanent object-centered displacement basin
- object-centered concentric ripples
- pointer-centered ripples whose strength follows pointer velocity
- restrained cyan/silver highlights
- vignette and fine grain

The shader receives object position, pointer position, pointer velocity, time, and symbol hover/proximity intensity as uniforms.

#### Three.js symbol system

Procedurally creates:

- five concentric metallic rings
- central triangular geometry
- lower curved geometry
- subtle additive glow/reflection support
- physically based metallic materials
- procedural environment reflection (no logo texture)
- key, fill, ambient and rim lights

Animation uses damping rather than direct pointer locking. The object has subtle idle float and sway, then increases tilt/translation when the compass approaches.

## 4. Current complete implementation

The complete implementation is the repository source itself:

- `index.html`
- `styles.css`
- `app.js`

These files are intentionally the canonical code blocks for this prototype so Codex can edit them directly instead of duplicating large source listings inside this specification.

## Next iteration targets

After visual testing in GitHub Pages, refine in this order:

1. geometry fidelity to the original Deep Structure mark
2. physical water contact / partial submersion illusion
3. material realism and edge highlights
4. cursor-to-wave response strength
5. mobile GPU performance
6. transition into the actual interior website
