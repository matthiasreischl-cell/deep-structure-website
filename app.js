const canvas = document.getElementById('fluid');
const button = document.getElementById('enterButton');
const transition = document.getElementById('transition');
const inside = document.getElementById('inside');
const compass = document.getElementById('compass');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const WATER_SPEED = reducedMotion ? 0 : 0.28;

let pointerX = innerWidth * 0.5;
let pointerY = innerHeight * 0.5;
let previousX = pointerX;
let previousY = pointerY;
let cursorX = pointerX;
let cursorY = pointerY;
let speed = 0;
let pointerEnergy = 0;
let entering = false;
let hoverTarget = 0;
let hoverCurrent = 0;
let rect = button.getBoundingClientRect();
let waterReady = false;
let rippleStart = -100;
let rippleX = 0.5;
let rippleY = 0.5;
let rippleStrength = 0;

const cursorState = { normX: 0, normY: 0, tiltX: 0, tiltY: 0 };

function refreshRect() {
  rect = button.getBoundingClientRect();
}

function updateHoverState() {
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.46;
  const dx = pointerX - cx;
  const dy = pointerY - cy;
  const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.42);
  const dist = Math.hypot(dx, dy);

  hoverTarget = coarsePointer
    ? 0
    : (dist < radius ? 1 : Math.max(0, 1 - (dist - radius) / (radius * 0.95)));

  cursorState.normX = Math.max(-1, Math.min(1, dx / radius));
  cursorState.normY = Math.max(-1, Math.min(1, dy / radius));
}

function triggerRipple(x, y, strength = 1) {
  rippleX = Math.max(0.02, Math.min(0.98, x));
  rippleY = Math.max(0.02, Math.min(0.98, y));
  rippleStrength = Math.max(0, Math.min(1, strength));
  rippleStart = performance.now() * 0.001;
}

function onPointerMove(event) {
  previousX = pointerX;
  previousY = pointerY;
  pointerX = event.clientX;
  pointerY = event.clientY;

  const dx = pointerX - previousX;
  const dy = pointerY - previousY;
  speed = Math.min(1.25, Math.hypot(dx, dy) / 34);

  const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  compass.style.setProperty('--needle-angle', `${angle}deg`);
  document.body.classList.add('pointer-ready');
  updateHoverState();

  if (!coarsePointer && event.pointerType !== 'touch') {
    pointerEnergy = Math.max(pointerEnergy, speed * hoverTarget);
  }
}

addEventListener('pointermove', onPointerMove, { passive: true });
addEventListener('pointerleave', () => {
  document.body.classList.remove('pointer-ready');
  hoverTarget = 0;
});
addEventListener('resize', () => {
  refreshRect();
  updateHoverState();
  resizeWater();
}, { passive: true });

button.addEventListener('mouseenter', () => {
  refreshRect();
  updateHoverState();
});

function animateCursor() {
  cursorX += (pointerX - cursorX) * 0.22;
  cursorY += (pointerY - cursorY) * 0.22;
  compass.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
  requestAnimationFrame(animateCursor);
}
animateCursor();

function objectUv() {
  const x = rect.left + rect.width * 0.5;
  const y = rect.top + rect.height * 0.46;
  return [x / Math.max(1, innerWidth), 1 - y / Math.max(1, innerHeight)];
}

function enter() {
  if (entering) return;
  entering = true;

  const [x, y] = objectUv();
  triggerRipple(x, y, coarsePointer ? 1.0 : 0.86);

  document.body.classList.add('entering');
  transition.setAttribute('aria-hidden', 'false');

  setTimeout(() => {
    document.body.classList.remove('entering');
    document.body.classList.add('entered');
    transition.setAttribute('aria-hidden', 'true');
    inside.setAttribute('aria-hidden', 'false');
    location.hash = 'inside';
    window.dispatchEvent(new CustomEvent('deepstructure:entered'));
  }, reducedMotion ? 100 : 3100);
}

button.addEventListener('pointerdown', (event) => {
  if (reducedMotion || !waterReady) return;
  if (event.pointerType === 'touch' || coarsePointer) {
    triggerRipple(
      event.clientX / Math.max(1, innerWidth),
      1 - event.clientY / Math.max(1, innerHeight),
      0.72
    );
  }
});

button.addEventListener('click', enter);
button.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    enter();
  }
});

function applyCssMotion() {
  hoverCurrent += (hoverTarget - hoverCurrent) * (reducedMotion ? 0.08 : 0.095);
  cursorState.tiltX += ((-cursorState.normY) - cursorState.tiltX) * 0.065;
  cursorState.tiltY += (cursorState.normX - cursorState.tiltY) * 0.065;

  button.style.setProperty('--hover', hoverCurrent.toFixed(4));
  button.style.setProperty('--cursor-x', (cursorState.tiltY * hoverCurrent).toFixed(4));
  button.style.setProperty('--cursor-y', (cursorState.tiltX * hoverCurrent).toFixed(4));
}

// Stylised slow water inspired by broad hand-drawn ripple bands.
// The surface is procedural and continuous across the viewport; interaction
// only perturbs it locally, so it reads as water rather than an effect cloud.
const gl = canvas.getContext('webgl', {
  antialias: false,
  alpha: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance'
});

let program = null;
let buffer = null;
let locations = null;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Water shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;

  const result = gl.createProgram();
  gl.attachShader(result, vertex);
  gl.attachShader(result, fragment);
  gl.linkProgram(result);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    console.error('Water program link error:', gl.getProgramInfoLog(result));
    gl.deleteProgram(result);
    return null;
  }
  return result;
}

if (gl) {
  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform vec2 uObjectPos;
    uniform vec2 uPointerPos;
    uniform vec2 uRipplePos;
    uniform float uTime;
    uniform float uHover;
    uniform float uPointerEnergy;
    uniform float uRippleAge;
    uniform float uRippleStrength;

    vec2 screenSpace(vec2 uv) {
      float aspect = uResolution.x / max(1.0, uResolution.y);
      vec2 p = uv - 0.5;
      p.x *= aspect;
      return p;
    }

    vec2 relativeTo(vec2 uv, vec2 origin) {
      float aspect = uResolution.x / max(1.0, uResolution.y);
      vec2 p = uv - origin;
      p.x *= aspect;
      return p;
    }

    float broadSurface(vec2 uv, float time) {
      vec2 p = screenSpace(uv);

      // Slow, large-scale drift. Frequencies stay deliberately low to avoid
      // glitter or pixel-like detail.
      float warpX = sin(p.y * 3.6 - time * 0.18) * 0.055
                  + sin(p.y * 7.0 + time * 0.11) * 0.018;
      float warpY = sin(p.x * 3.0 + time * 0.15) * 0.045
                  + sin(p.x * 5.4 - time * 0.09) * 0.016;
      vec2 q = p + vec2(warpX, warpY);

      float h = 0.0;
      h += sin(dot(q, normalize(vec2(0.98, 0.22))) * 7.0 + time * 0.36) * 0.072;
      h += sin(dot(q, normalize(vec2(-0.38, 0.93))) * 9.3 - time * 0.27) * 0.052;
      h += sin(dot(q, normalize(vec2(0.63, -0.78))) * 12.2 + time * 0.19) * 0.032;
      return h;
    }

    float contactWaves(vec2 uv, float time) {
      vec2 p = relativeTo(uv, uObjectPos);
      float d = length(p);

      // A floating object makes broad, slightly irregular rings. They are
      // intentionally slow and low amplitude in the idle state.
      float wobble = sin(atan(p.y, p.x) * 3.0 + time * 0.17) * 0.012;
      float ring = sin((d + wobble) * 31.0 - time * 0.44);
      float envelope = exp(-d * 4.2) * smoothstep(0.42, 0.05, d);
      return ring * envelope * (0.010 + uHover * 0.010);
    }

    float pointerWaves(vec2 uv, float time) {
      vec2 p = relativeTo(uv, uPointerPos);
      float d = length(p);
      float energy = min(1.0, uPointerEnergy) * uHover;
      float wave = sin(d * 34.0 - time * 0.72);
      float envelope = exp(-d * 8.5);
      return wave * envelope * energy * 0.016;
    }

    float clickWaves(vec2 uv) {
      if (uRippleAge < 0.0 || uRippleAge > 6.5) return 0.0;

      vec2 p = relativeTo(uv, uRipplePos);
      float d = length(p);

      // Travelling packet: a few broad rings, not a single glowing circle.
      float front = uRippleAge * 0.105;
      float x = d - front;
      float packet = exp(-pow(x / 0.115, 2.0));
      float rings = sin(x * 78.0);
      float decay = exp(-uRippleAge * 0.48);
      return rings * packet * decay * uRippleStrength * 0.085;
    }

    float heightField(vec2 uv, float time) {
      return broadSurface(uv, time)
           + contactWaves(uv, time)
           + pointerWaves(uv, time)
           + clickWaves(uv);
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / max(1.0, uResolution.y);
      float epsX = 1.6 / max(1.0, uResolution.x);
      float epsY = 1.6 / max(1.0, uResolution.y);

      float h = heightField(uv, uTime);
      float hL = heightField(uv - vec2(epsX, 0.0), uTime);
      float hR = heightField(uv + vec2(epsX, 0.0), uTime);
      float hD = heightField(uv - vec2(0.0, epsY), uTime);
      float hU = heightField(uv + vec2(0.0, epsY), uTime);

      vec2 gradient = vec2((hL - hR) * aspect, hD - hU);
      vec3 normal = normalize(vec3(gradient * 34.0, 1.0));
      float slope = clamp(length(gradient) * 72.0, 0.0, 1.0);

      // Deep Structure palette: pool behaviour, dark petrol material.
      vec3 abyss = vec3(0.0025, 0.012, 0.016);
      vec3 deep = vec3(0.006, 0.040, 0.050);
      vec3 teal = vec3(0.025, 0.145, 0.160);
      vec3 cyan = vec3(0.17, 0.47, 0.49);
      vec3 silver = vec3(0.64, 0.86, 0.86);

      float body = clamp(0.48 + h * 2.0, 0.0, 1.0);
      vec3 color = mix(abyss, deep, 0.70 + body * 0.22);
      color = mix(color, teal, smoothstep(0.035, 0.13, h) * 0.42);

      // Wide connected highlights follow the wave slope. No random grain is
      // used, so highlights form bands rather than sparkling points.
      vec3 lightA = normalize(vec3(-0.38, 0.50, 0.78));
      vec3 lightB = normalize(vec3(0.54, -0.20, 0.82));
      float specA = pow(max(dot(normal, lightA), 0.0), 13.0);
      float specB = pow(max(dot(normal, lightB), 0.0), 22.0);
      float crest = smoothstep(0.20, 0.76, slope);

      color += cyan * specA * 0.22;
      color += silver * specB * 0.18;
      color += teal * crest * 0.18;

      // Contact zone: slightly darker beneath the symbol, with a thin broken
      // silver rim so the mark appears to sit on the water instead of above it.
      vec2 objectP = relativeTo(uv, uObjectPos);
      float objectD = length(objectP);
      float contact = exp(-objectD * objectD * 72.0);
      float rim = exp(-pow((objectD - 0.145) / 0.036, 2.0));
      color *= 1.0 - contact * 0.14;
      color += silver * rim * (0.012 + slope * 0.028);

      // Very restrained depth falloff; the water remains visible across the
      // whole viewport instead of forming a circular effect around the logo.
      vec2 vp = screenSpace(uv);
      float vignette = smoothstep(1.08, 0.28, length(vp));
      color *= 0.86 + vignette * 0.16;

      color = max(color, vec3(0.002, 0.010, 0.013));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  program = createProgram(vertexSource, fragmentSource);

  if (program) {
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1
      ]),
      gl.STATIC_DRAW
    );

    locations = {
      position: gl.getAttribLocation(program, 'aPosition'),
      resolution: gl.getUniformLocation(program, 'uResolution'),
      objectPos: gl.getUniformLocation(program, 'uObjectPos'),
      pointerPos: gl.getUniformLocation(program, 'uPointerPos'),
      ripplePos: gl.getUniformLocation(program, 'uRipplePos'),
      time: gl.getUniformLocation(program, 'uTime'),
      hover: gl.getUniformLocation(program, 'uHover'),
      pointerEnergy: gl.getUniformLocation(program, 'uPointerEnergy'),
      rippleAge: gl.getUniformLocation(program, 'uRippleAge'),
      rippleStrength: gl.getUniformLocation(program, 'uRippleStrength')
    };

    waterReady = true;
  }
}

function resizeWater() {
  if (!gl) return;
  const dpr = Math.min(devicePixelRatio || 1, coarsePointer ? 1.45 : 1.65);
  canvas.width = Math.max(1, Math.round(innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(innerHeight * dpr));
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resizeWater();

function renderWater(now) {
  if (!waterReady) return;

  const seconds = now * 0.001;
  const [objectX, objectY] = objectUv();
  const rippleAge = rippleStart < 0 ? -1 : seconds - rippleStart;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(locations.resolution, canvas.width, canvas.height);
  gl.uniform2f(locations.objectPos, objectX, objectY);
  gl.uniform2f(
    locations.pointerPos,
    pointerX / Math.max(1, innerWidth),
    1 - pointerY / Math.max(1, innerHeight)
  );
  gl.uniform2f(locations.ripplePos, rippleX, rippleY);
  gl.uniform1f(locations.time, seconds * WATER_SPEED);
  gl.uniform1f(locations.hover, hoverCurrent);
  gl.uniform1f(locations.pointerEnergy, pointerEnergy);
  gl.uniform1f(locations.rippleAge, rippleAge);
  gl.uniform1f(locations.rippleStrength, rippleStrength);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

refreshRect();
updateHoverState();

function animate(now) {
  applyCssMotion();
  refreshRect();
  updateHoverState();
  renderWater(now);
  pointerEnergy *= 0.92;
  speed *= 0.91;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
