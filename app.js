const canvas = document.getElementById('fluid');
const button = document.getElementById('enterButton');
const transition = document.getElementById('transition');
const inside = document.getElementById('inside');
const compass = document.getElementById('compass');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;

let pointerX = innerWidth * 0.5;
let pointerY = innerHeight * 0.5;
let previousX = pointerX;
let previousY = pointerY;
let cursorX = pointerX;
let cursorY = pointerY;
let speed = 0;
let entering = false;
let hoverTarget = 0;
let hoverCurrent = 0;
let rect = button.getBoundingClientRect();

const cursorState = {
  normX: 0,
  normY: 0,
  tiltX: 0,
  tiltY: 0
};

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
    : (dist < radius
      ? 1
      : Math.max(0, 1 - (dist - radius) / (radius * 0.9)));

  cursorState.normX = Math.max(-1, Math.min(1, dx / radius));
  cursorState.normY = Math.max(-1, Math.min(1, dy / radius));
}

function onPointerMove(event) {
  previousX = pointerX;
  previousY = pointerY;
  pointerX = event.clientX;
  pointerY = event.clientY;

  const dx = pointerX - previousX;
  const dy = pointerY - previousY;
  speed = Math.min(1.45, Math.hypot(dx, dy) / 28);

  const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  compass.style.setProperty('--needle-angle', `${angle}deg`);
  document.body.classList.add('pointer-ready');
  updateHoverState();

  // Desktop mouse motion creates sparse, shallow disturbances only.
  // Touch movement is ignored here; touch gets one stronger impulse on contact.
  if (
    !reducedMotion &&
    !coarsePointer &&
    event.pointerType !== 'touch' &&
    speed > 0.13 &&
    waterReady
  ) {
    const now = performance.now();
    if (now - lastPointerImpulse > 105) {
      queueRipple(
        pointerX / Math.max(1, innerWidth),
        1 - pointerY / Math.max(1, innerHeight),
        -Math.min(0.075, 0.026 + speed * 0.030),
        0.012 + Math.min(0.004, speed * 0.0025)
      );
      lastPointerImpulse = now;
    }
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

function objectUv(offsetX = 0, offsetY = 0) {
  const x = rect.left + rect.width * (0.5 + offsetX);
  const y = rect.top + rect.height * (0.46 + offsetY);
  return [
    x / Math.max(1, innerWidth),
    1 - y / Math.max(1, innerHeight)
  ];
}

function enter() {
  if (entering) return;
  entering = true;

  // One clear central disturbance on entry, followed by a smaller opposite
  // impulse. The heightfield turns this into a short train of shallow waves.
  const [x, y] = objectUv();
  queueRipple(x, y, -0.23, 0.026);
  queueRipple(x + 0.008, y - 0.005, 0.075, 0.017);

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

  // Touch gets a clearer tactile-looking disturbance. Mouse clicks remain
  // restrained because the entry impulse above supplies the main wave.
  const touchLike = event.pointerType === 'touch' || coarsePointer;
  queueRipple(
    event.clientX / Math.max(1, innerWidth),
    1 - event.clientY / Math.max(1, innerHeight),
    touchLike ? -0.16 : -0.065,
    touchLike ? 0.021 : 0.014
  );
});

button.addEventListener('click', enter);
button.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    enter();
  }
});

function applyCssMotion() {
  hoverCurrent += (hoverTarget - hoverCurrent) * (reducedMotion ? 0.08 : 0.12);
  cursorState.tiltX += ((-cursorState.normY) - cursorState.tiltX) * 0.08;
  cursorState.tiltY += (cursorState.normX - cursorState.tiltY) * 0.08;

  button.style.setProperty('--hover', hoverCurrent.toFixed(4));
  button.style.setProperty('--cursor-x', (cursorState.tiltY * hoverCurrent).toFixed(4));
  button.style.setProperty('--cursor-y', (cursorState.tiltX * hoverCurrent).toFixed(4));
}

// ===== GPU heightfield water =====
// Height + vertical velocity are stored in two ping-pong textures. The shader
// solves a damped 2D wave equation. Aspect correction keeps wave fronts circular
// in screen space on both portrait phones and landscape desktops.
const gl = canvas.getContext('webgl', {
  antialias: false,
  alpha: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance'
});

const SIM_SIZE = coarsePointer || innerWidth < 900 ? 256 : 384;
const NEUTRAL = 128 / 255;
const FIXED_STEP = 1000 / 60;
const rippleQueue = [];

let simulationProgram = null;
let displayProgram = null;
let quadBuffer = null;
let stateTextures = [];
let stateFramebuffers = [];
let stateIndex = 0;
let waterReady = false;
let lastWaterTime = performance.now();
let simulationAccumulator = 0;
let lastPointerImpulse = 0;
let nextObjectPulse = performance.now() + 1800;

function queueRipple(x, y, strength, radius) {
  if (!waterReady || reducedMotion) return;

  // Clamp injected energy before it enters the simulation. This prevents the
  // accumulating dark holes seen when many impulses overlap.
  const maxStrength = coarsePointer ? 0.24 : 0.18;
  rippleQueue.push({
    x: Math.max(0.015, Math.min(0.985, x)),
    y: Math.max(0.015, Math.min(0.985, y)),
    strength: Math.max(-maxStrength, Math.min(maxStrength, strength)),
    radius: Math.max(0.010, Math.min(0.032, radius))
  });

  // A short queue is intentional: old input is discarded rather than turning
  // the whole surface into persistent turbulence.
  if (rippleQueue.length > 6) rippleQueue.shift();
}

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

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Water program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createStateTarget(initialData) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    SIM_SIZE,
    SIM_SIZE,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    initialData
  );

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return complete ? { texture, framebuffer } : null;
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

  const simulationFragment = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uState;
    uniform vec2 uTexel;
    uniform vec2 uImpulsePos;
    uniform float uImpulse;
    uniform float uImpulseRadius;
    uniform float uAspect;

    const float neutral = ${NEUTRAL.toFixed(10)};

    float heightAt(vec2 uv) {
      return (texture2D(uState, uv).r - neutral) * 2.0;
    }

    void main() {
      vec4 state = texture2D(uState, vUv);
      float h = (state.r - neutral) * 2.0;
      float velocity = (state.g - neutral) * 2.0;

      float leftH  = heightAt(vUv - vec2(uTexel.x, 0.0));
      float rightH = heightAt(vUv + vec2(uTexel.x, 0.0));
      float downH  = heightAt(vUv - vec2(0.0, uTexel.y));
      float upH    = heightAt(vUv + vec2(0.0, uTexel.y));

      float horizontalWeight = 1.0 / max(0.20, uAspect * uAspect);
      float laplacian = (leftH + rightH - 2.0 * h) * horizontalWeight
        + (downH + upH - 2.0 * h);

      velocity += laplacian * 0.245;
      velocity *= 0.988;

      if (abs(uImpulse) > 0.0001) {
        vec2 d = vUv - uImpulsePos;
        d.x *= uAspect;
        float gaussian = exp(-dot(d, d) / max(0.000001, uImpulseRadius * uImpulseRadius));
        velocity += uImpulse * gaussian;
      }

      h += velocity * 0.50;

      // Local soft limiter: enough amplitude for readable crests, but no deep
      // pits or runaway velocity when several disturbances overlap.
      float energy = abs(h) + abs(velocity) * 0.85;
      if (energy > 0.40) {
        float limiter = 0.40 / energy;
        h *= limiter;
        velocity *= limiter;
      }

      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float edgeMask = smoothstep(0.0, 0.065, edge);
      h *= mix(0.84, 1.0, edgeMask);
      velocity *= mix(0.72, 1.0, edgeMask);

      h = clamp(h, -0.32, 0.32);
      velocity = clamp(velocity, -0.26, 0.26);

      gl_FragColor = vec4(
        h * 0.5 + neutral,
        velocity * 0.5 + neutral,
        0.0,
        1.0
      );
    }
  `;

  const displayFragment = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uState;
    uniform vec2 uTexel;
    uniform vec2 uResolution;
    uniform vec2 uObjectPos;
    uniform float uTime;
    uniform float uHover;

    const float neutral = ${NEUTRAL.toFixed(10)};

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float heightAt(vec2 uv) {
      return (texture2D(uState, uv).r - neutral) * 2.0;
    }

    float velocityAt(vec2 uv) {
      return (texture2D(uState, uv).g - neutral) * 2.0;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / max(1.0, uResolution.y);
      float h = heightAt(uv);
      float velocity = velocityAt(uv);
      float hL = heightAt(uv - vec2(uTexel.x, 0.0));
      float hR = heightAt(uv + vec2(uTexel.x, 0.0));
      float hD = heightAt(uv - vec2(0.0, uTexel.y));
      float hU = heightAt(uv + vec2(0.0, uTexel.y));

      // Use physical screen-space slope so portrait and landscape devices read
      // the same way visually.
      vec2 gradient = vec2((hL - hR) / max(0.25, aspect), hD - hU);
      float slope = min(1.0, length(gradient) * 8.0);
      float curvature = abs((hL + hR - 2.0 * h) / max(0.20, aspect * aspect)
        + hD + hU - 2.0 * h);
      float motion = min(1.0, abs(velocity) * 5.0 + slope * 0.85);

      vec3 normal = normalize(vec3(gradient * 6.2, 0.62));
      vec2 reflectedUv = uv + vec2(normal.x / max(0.35, aspect), normal.y) * 0.018 * motion;

      vec2 p = reflectedUv - 0.5;
      p.x *= aspect;

      // The idle surface is intentionally almost featureless. A very low level
      // broad variation keeps it alive without reading as silver noise.
      float t = uTime * 0.025;
      float broad = noise(p * 2.0 + vec2(t, -t * 0.55));
      float idleSheen = (broad - 0.5) * 0.018;

      vec3 blackWater = vec3(0.002, 0.0055, 0.0075);
      vec3 deepWater = vec3(0.008, 0.020, 0.026);
      vec3 cold = vec3(0.28, 0.39, 0.43);
      vec3 silver = vec3(0.78, 0.90, 0.94);

      vec3 col = mix(blackWater, deepWater, 0.58 + idleSheen);

      // Reflections only wake up where the simulated surface is moving.
      vec3 lightDir = normalize(vec3(-0.30, 0.50, 0.81));
      float specular = pow(max(dot(normal, lightDir), 0.0), 30.0) * motion;
      float crest = smoothstep(0.012, 0.075, curvature) * smoothstep(0.07, 0.65, motion);
      float grazing = pow(clamp(1.0 - normal.z, 0.0, 1.0), 1.8) * motion;
      col += cold * slope * motion * 0.085;
      col += silver * (specular * 0.25 + crest * 0.19 + grazing * 0.065);

      // A subtle highlight around the active wave field adds readability, but
      // the height value itself never darkens the surface into a black pit.
      col += vec3(0.06, 0.10, 0.11) * abs(h) * 0.20;

      vec2 objectDelta = uv - uObjectPos;
      objectDelta.x *= aspect;
      float objectContact = exp(-dot(objectDelta, objectDelta) * 52.0);
      col += vec3(0.014, 0.024, 0.027) * objectContact * (0.35 + uHover * 0.25);

      float vignette = smoothstep(0.92, 0.24, length(p));
      col *= 0.84 + vignette * 0.18;

      float grain = (hash(gl_FragCoord.xy + uTime * 0.31) - 0.5) * 0.0025;
      col += grain;
      col = max(col, vec3(0.0018, 0.0045, 0.0060));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  simulationProgram = createProgram(vertexSource, simulationFragment);
  displayProgram = createProgram(vertexSource, displayFragment);

  if (simulationProgram && displayProgram) {
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1
      ]),
      gl.STATIC_DRAW
    );

    const initialState = new Uint8Array(SIM_SIZE * SIM_SIZE * 4);
    for (let i = 0; i < SIM_SIZE * SIM_SIZE; i++) {
      const p = i * 4;
      initialState[p] = 128;
      initialState[p + 1] = 128;
      initialState[p + 2] = 0;
      initialState[p + 3] = 255;
    }

    const a = createStateTarget(initialState);
    const b = createStateTarget(initialState);

    if (a && b) {
      stateTextures = [a.texture, b.texture];
      stateFramebuffers = [a.framebuffer, b.framebuffer];
      waterReady = true;
    }
  }
}

function bindQuad(program) {
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
}

function simulateStep(impulse = null) {
  if (!waterReady) return;

  const source = stateIndex;
  const target = 1 - stateIndex;

  gl.bindFramebuffer(gl.FRAMEBUFFER, stateFramebuffers[target]);
  gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
  gl.useProgram(simulationProgram);
  bindQuad(simulationProgram);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, stateTextures[source]);
  gl.uniform1i(gl.getUniformLocation(simulationProgram, 'uState'), 0);
  gl.uniform2f(gl.getUniformLocation(simulationProgram, 'uTexel'), 1 / SIM_SIZE, 1 / SIM_SIZE);
  gl.uniform1f(
    gl.getUniformLocation(simulationProgram, 'uAspect'),
    Math.max(0.35, Math.min(3.2, innerWidth / Math.max(1, innerHeight)))
  );

  if (impulse) {
    gl.uniform2f(gl.getUniformLocation(simulationProgram, 'uImpulsePos'), impulse.x, impulse.y);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uImpulse'), impulse.strength);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uImpulseRadius'), impulse.radius);
  } else {
    gl.uniform2f(gl.getUniformLocation(simulationProgram, 'uImpulsePos'), 0.5, 0.5);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uImpulse'), 0);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uImpulseRadius'), 0.01);
  }

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  stateIndex = target;
}

function resizeWater() {
  if (!gl) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.65);
  canvas.width = Math.max(1, Math.round(innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(innerHeight * dpr));
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
}
resizeWater();

function addObjectDisturbance(now) {
  if (!waterReady || reducedMotion || now < nextObjectPulse) return;

  // Calm idle water: the symbol adds only an occasional, low-energy contact
  // disturbance. Hover increases it enough to become visible, not chaotic.
  const energy = 0.013 + hoverCurrent * 0.024;
  const offsetX = (Math.random() - 0.5) * 0.018;
  const offsetY = (Math.random() - 0.5) * 0.010;
  const [x, y] = objectUv(offsetX, offsetY);
  queueRipple(x, y, -energy, 0.015 + Math.random() * 0.004);

  nextObjectPulse = now + (hoverCurrent > 0.20
    ? 1350 + Math.random() * 900
    : 3000 + Math.random() * 1800);
}

function renderWater(now) {
  if (!waterReady) return;

  addObjectDisturbance(now);

  const elapsed = Math.min(50, Math.max(0, now - lastWaterTime));
  lastWaterTime = now;
  simulationAccumulator += elapsed;

  let steps = 0;
  while (simulationAccumulator >= FIXED_STEP && steps < 3) {
    simulateStep(rippleQueue.shift() || null);
    simulationAccumulator -= FIXED_STEP;
    steps++;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(displayProgram);
  bindQuad(displayProgram);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, stateTextures[stateIndex]);
  gl.uniform1i(gl.getUniformLocation(displayProgram, 'uState'), 0);
  gl.uniform2f(gl.getUniformLocation(displayProgram, 'uTexel'), 1 / SIM_SIZE, 1 / SIM_SIZE);
  gl.uniform2f(gl.getUniformLocation(displayProgram, 'uResolution'), canvas.width, canvas.height);

  const [objectX, objectY] = objectUv();
  gl.uniform2f(gl.getUniformLocation(displayProgram, 'uObjectPos'), objectX, objectY);
  gl.uniform1f(gl.getUniformLocation(displayProgram, 'uTime'), now * 0.001);
  gl.uniform1f(gl.getUniformLocation(displayProgram, 'uHover'), hoverCurrent);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

refreshRect();
updateHoverState();

function animate(now) {
  applyCssMotion();
  refreshRect();
  updateHoverState();
  renderWater(now);
  speed *= 0.92;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
