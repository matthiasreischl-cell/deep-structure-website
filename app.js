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
    : (dist < radius ? 1 : Math.max(0, 1 - (dist - radius) / (radius * 0.85)));

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
  speed = Math.min(1.4, Math.hypot(dx, dy) / 30);

  const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  compass.style.setProperty('--needle-angle', `${angle}deg`);
  document.body.classList.add('pointer-ready');
  updateHoverState();

  if (
    !reducedMotion &&
    !coarsePointer &&
    event.pointerType !== 'touch' &&
    hoverTarget > 0.14 &&
    speed > 0.10 &&
    waterReady
  ) {
    const now = performance.now();
    if (now - lastPointerImpulse > 135) {
      const proximity = Math.max(0, Math.min(1, hoverTarget));
      queueRipple(
        pointerX / Math.max(1, innerWidth),
        1 - pointerY / Math.max(1, innerHeight),
        -Math.min(0.055, 0.016 + speed * 0.021) * (0.55 + proximity * 0.45),
        0.013 + proximity * 0.003
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
  return [x / Math.max(1, innerWidth), 1 - y / Math.max(1, innerHeight)];
}

function enter() {
  if (entering) return;
  entering = true;

  const [x, y] = objectUv();
  queueRipple(x, y, coarsePointer ? -0.22 : -0.18, 0.028);
  queueRipple(x + 0.007, y - 0.004, coarsePointer ? 0.075 : 0.060, 0.018);

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

  const touchLike = event.pointerType === 'touch' || coarsePointer;
  queueRipple(
    event.clientX / Math.max(1, innerWidth),
    1 - event.clientY / Math.max(1, innerHeight),
    touchLike ? -0.13 : -0.045,
    touchLike ? 0.022 : 0.014
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
  hoverCurrent += (hoverTarget - hoverCurrent) * (reducedMotion ? 0.08 : 0.10);
  cursorState.tiltX += ((-cursorState.normY) - cursorState.tiltX) * 0.07;
  cursorState.tiltY += (cursorState.normX - cursorState.tiltY) * 0.07;

  button.style.setProperty('--hover', hoverCurrent.toFixed(4));
  button.style.setProperty('--cursor-x', (cursorState.tiltY * hoverCurrent).toFixed(4));
  button.style.setProperty('--cursor-y', (cursorState.tiltX * hoverCurrent).toFixed(4));
}

// Calm reflective pool + local GPU heightfield.
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
let nextObjectPulse = performance.now() + 2200;

function queueRipple(x, y, strength, radius) {
  if (!waterReady || reducedMotion) return;

  const maxStrength = coarsePointer ? 0.23 : 0.17;
  rippleQueue.push({
    x: Math.max(0.015, Math.min(0.985, x)),
    y: Math.max(0.015, Math.min(0.985, y)),
    strength: Math.max(-maxStrength, Math.min(maxStrength, strength)),
    radius: Math.max(0.011, Math.min(0.034, radius))
  });

  if (rippleQueue.length > 5) rippleQueue.shift();
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
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialData);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

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
      float laplacian =
        (leftH + rightH - 2.0 * h) * horizontalWeight +
        (downH + upH - 2.0 * h);

      velocity += laplacian * 0.235;
      velocity *= 0.986;

      if (abs(uImpulse) > 0.0001) {
        vec2 d = vUv - uImpulsePos;
        d.x *= uAspect;
        float gaussian = exp(-dot(d, d) / max(0.000001, uImpulseRadius * uImpulseRadius));
        velocity += uImpulse * gaussian;
      }

      h += velocity * 0.47;

      float energy = abs(h) + abs(velocity) * 0.9;
      if (energy > 0.32) {
        float limiter = 0.32 / energy;
        h *= limiter;
        velocity *= limiter;
      }

      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float edgeMask = smoothstep(0.0, 0.07, edge);
      h *= mix(0.82, 1.0, edgeMask);
      velocity *= mix(0.68, 1.0, edgeMask);

      h = clamp(h, -0.25, 0.25);
      velocity = clamp(velocity, -0.21, 0.21);

      gl_FragColor = vec4(h * 0.5 + neutral, velocity * 0.5 + neutral, 0.0, 1.0);
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

    vec2 directionalPoolSlope(vec2 p, float t) {
      vec2 d1 = normalize(vec2(0.96, 0.28));
      vec2 d2 = normalize(vec2(-0.42, 0.91));
      vec2 d3 = normalize(vec2(0.58, -0.82));
      vec2 d4 = normalize(vec2(-0.88, -0.47));

      float q1 = dot(p, d1) * 14.0 + t * 0.72;
      float q2 = dot(p, d2) * 19.0 - t * 0.54;
      float q3 = dot(p, d3) * 27.0 + t * 0.37;
      float q4 = dot(p, d4) * 35.0 - t * 0.29;

      vec2 slope = vec2(0.0);
      slope += d1 * cos(q1) * 0.015;
      slope += d2 * cos(q2) * 0.011;
      slope += d3 * cos(q3) * 0.0065;
      slope += d4 * cos(q4) * 0.0035;
      return slope;
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uResolution.x / max(1.0, uResolution.y);
      float t = uTime;

      float h = heightAt(uv);
      float velocity = velocityAt(uv);
      float hL = heightAt(uv - vec2(uTexel.x, 0.0));
      float hR = heightAt(uv + vec2(uTexel.x, 0.0));
      float hD = heightAt(uv - vec2(0.0, uTexel.y));
      float hU = heightAt(uv + vec2(0.0, uTexel.y));

      vec2 simGradient = vec2((hL - hR) / max(0.25, aspect), hD - hU);

      vec2 p = uv - 0.5;
      p.x *= aspect;

      vec2 baseSlope = directionalPoolSlope(p, t);
      float drift = noise(p * 1.55 + vec2(t * 0.018, -t * 0.012)) - 0.5;
      baseSlope += vec2(drift * 0.005, -drift * 0.0035);

      float simSlopeStrength = min(1.0, length(simGradient) * 8.2);
      float simMotion = min(1.0, abs(velocity) * 4.5 + simSlopeStrength * 0.75);
      vec2 combinedSlope = baseSlope + simGradient * (1.55 + simMotion * 0.55);

      vec3 normal = normalize(vec3(combinedSlope * 7.2, 0.80));

      vec3 keyLight = normalize(vec3(-0.42, 0.58, 0.70));
      vec3 fillLight = normalize(vec3(0.62, -0.18, 0.76));

      float keySpec = pow(max(dot(normal, keyLight), 0.0), 24.0);
      float fillSpec = pow(max(dot(normal, fillLight), 0.0), 34.0);
      float fresnel = pow(clamp(1.0 - normal.z, 0.0, 1.0), 2.2);

      float curvature = abs(
        (hL + hR - 2.0 * h) / max(0.20, aspect * aspect) +
        hD + hU - 2.0 * h
      );
      float crest = smoothstep(0.010, 0.060, curvature) * simMotion;

      vec2 reflectedP = p + vec2(normal.x, normal.y) * (0.030 + simMotion * 0.018);

      float skyBand =
        smoothstep(-0.58, 0.32, reflectedP.y) *
        (1.0 - smoothstep(0.36, 0.86, reflectedP.y));

      float broadVariation = noise(reflectedP * vec2(1.25, 1.8) + vec2(t * 0.012, -t * 0.009));
      float reflectionField = skyBand * (0.52 + broadVariation * 0.48);

      vec3 blackWater = vec3(0.0025, 0.0080, 0.0115);
      vec3 deepPetrol = vec3(0.010, 0.038, 0.050);
      vec3 poolBlue = vec3(0.030, 0.105, 0.132);
      vec3 coldSilver = vec3(0.58, 0.75, 0.80);
      vec3 crestSilver = vec3(0.82, 0.93, 0.96);

      vec3 col = mix(blackWater, deepPetrol, 0.63);
      col += poolBlue * reflectionField * 0.18;

      float baseSparkle = (keySpec * 0.14 + fillSpec * 0.07) * (0.42 + reflectionField * 0.58);
      col += coldSilver * baseSparkle;

      col += crestSilver * (
        crest * 0.24 +
        keySpec * simMotion * 0.18 +
        fresnel * simMotion * 0.075
      );
      col += poolBlue * simSlopeStrength * simMotion * 0.08;

      vec2 objectDelta = uv - uObjectPos;
      objectDelta.x *= aspect;
      objectDelta.y *= 1.42;
      float contactCore = exp(-dot(objectDelta, objectDelta) * 48.0);
      float contactOuter = exp(-dot(objectDelta, objectDelta) * 22.0);
      float contactRim = max(0.0, contactOuter - contactCore * 0.82);

      col *= 1.0 - contactCore * (0.070 + uHover * 0.030);
      col += coldSilver * contactRim * (0.035 + uHover * 0.018);

      float vignette = smoothstep(0.98, 0.28, length(p));
      col *= 0.84 + vignette * 0.18;

      float grain = (hash(gl_FragCoord.xy + uTime * 0.17) - 0.5) * 0.0018;
      col += grain;
      col = max(col, vec3(0.0020, 0.0065, 0.0090));

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

  const dpr = Math.min(devicePixelRatio || 1, coarsePointer ? 1.45 : 1.65);
  canvas.width = Math.max(1, Math.round(innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(innerHeight * dpr));
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
}
resizeWater();

function addObjectDisturbance(now) {
  if (!waterReady || reducedMotion || now < nextObjectPulse) return;

  const energy = 0.009 + hoverCurrent * 0.014;
  const offsetX = (Math.random() - 0.5) * 0.012;
  const offsetY = (Math.random() - 0.5) * 0.007;
  const [x, y] = objectUv(offsetX, offsetY);

  queueRipple(x, y, -energy, 0.014 + Math.random() * 0.003);

  nextObjectPulse = now + (
    hoverCurrent > 0.18
      ? 1600 + Math.random() * 950
      : 3400 + Math.random() * 1900
  );
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
  gl.uniform1f(gl.getUniformLocation(displayProgram, 'uTime'), reducedMotion ? 0 : now * 0.001);
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
  speed *= 0.91;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
