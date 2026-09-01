const canvas = document.getElementById('fluid');
const button = document.getElementById('enterButton');
const transition = document.getElementById('transition');
const inside = document.getElementById('inside');
const compass = document.getElementById('compass');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  hoverTarget = dist < radius
    ? 1
    : Math.max(0, 1 - (dist - radius) / (radius * 0.9));

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

  if (!reducedMotion && speed > 0.075 && waterReady) {
    const now = performance.now();
    if (now - lastPointerImpulse > 42) {
      queueRipple(
        pointerX / Math.max(1, innerWidth),
        1 - pointerY / Math.max(1, innerHeight),
        -Math.min(0.24, 0.060 + speed * 0.10),
        0.014 + Math.min(0.010, speed * 0.006)
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

  const [x, y] = objectUv();
  queueRipple(x, y, -0.58, 0.038);
  queueRipple(x + 0.012, y - 0.008, 0.26, 0.024);

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
  if (reducedMotion) return;
  queueRipple(
    event.clientX / Math.max(1, innerWidth),
    1 - event.clientY / Math.max(1, innerHeight),
    -0.34,
    0.022
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
// The water state is stored as height + velocity in a pair of RGBA textures.
// Each fixed simulation step solves a damped 2D wave equation. Disturbances are
// local dimples; expanding rings are produced by the simulation itself rather
// than drawn as light circles.
const gl = canvas.getContext('webgl', {
  antialias: false,
  alpha: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance'
});

const SIM_SIZE = matchMedia('(pointer: coarse)').matches || innerWidth < 900 ? 256 : 384;
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
let nextObjectPulse = performance.now() + 1200;
let lastObjectX = 0;
let lastObjectY = 0;

function queueRipple(x, y, strength, radius) {
  if (!waterReady || reducedMotion) return;
  rippleQueue.push({
    x: Math.max(0.01, Math.min(0.99, x)),
    y: Math.max(0.01, Math.min(0.99, y)),
    strength,
    radius
  });
  if (rippleQueue.length > 12) rippleQueue.shift();
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

      float laplacian = leftH + rightH + downH + upH - 4.0 * h;
      velocity += laplacian * 0.285;
      velocity *= 0.996;

      if (abs(uImpulse) > 0.0001) {
        vec2 d = vUv - uImpulsePos;
        float gaussian = exp(-dot(d, d) / max(0.000001, uImpulseRadius * uImpulseRadius));
        velocity += uImpulse * gaussian;
      }

      h += velocity * 0.62;

      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float edgeMask = smoothstep(0.0, 0.055, edge);
      h *= mix(0.90, 1.0, edgeMask);
      velocity *= mix(0.84, 1.0, edgeMask);

      h = clamp(h, -0.94, 0.94);
      velocity = clamp(velocity, -0.94, 0.94);

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

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.86, -0.51, 0.51, 0.86);
      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p = rotation * p * 2.03 + 11.7;
        amplitude *= 0.5;
      }
      return value;
    }

    float heightAt(vec2 uv) {
      return (texture2D(uState, uv).r - neutral) * 2.0;
    }

    void main() {
      vec2 uv = vUv;
      float h = heightAt(uv);
      float hL = heightAt(uv - vec2(uTexel.x, 0.0));
      float hR = heightAt(uv + vec2(uTexel.x, 0.0));
      float hD = heightAt(uv - vec2(0.0, uTexel.y));
      float hU = heightAt(uv + vec2(0.0, uTexel.y));

      vec2 gradient = vec2(hL - hR, hD - hU);
      vec3 normal = normalize(vec3(gradient * 9.2, 0.34));
      float slope = min(1.0, length(gradient) * 9.5);
      float curvature = abs(hL + hR + hD + hU - 4.0 * h);

      vec2 reflectedUv = uv + normal.xy * 0.045;
      vec2 aspectP = reflectedUv - 0.5;
      aspectP.x *= uResolution.x / max(1.0, uResolution.y);

      float t = uTime * 0.055;
      float broadReflection = fbm(aspectP * 2.25 + vec2(t, -t * 0.55));
      float fineReflection = fbm(aspectP * 5.4 - vec2(t * 0.42, t * 0.31));
      float reflectionField = broadReflection * 0.72 + fineReflection * 0.28;

      vec3 deepBlack = vec3(0.0025, 0.007, 0.010);
      vec3 deepWater = vec3(0.014, 0.038, 0.050);
      vec3 coldReflection = vec3(0.38, 0.50, 0.55);
      vec3 silver = vec3(0.88, 0.96, 1.00);

      float verticalLight = smoothstep(0.05, 0.92, reflectedUv.y);
      vec3 col = mix(deepBlack, deepWater, 0.64 + reflectionField * 0.32 + verticalLight * 0.10);

      float reflection = smoothstep(0.45, 0.78, reflectionField + normal.y * 0.18);
      col += coldReflection * reflection * (0.075 + slope * 0.19);

      vec3 lightDir = normalize(vec3(-0.34, 0.52, 0.78));
      float specular = pow(max(dot(normal, lightDir), 0.0), 22.0);
      float grazing = pow(clamp(1.0 - normal.z, 0.0, 1.0), 1.45);
      float crest = smoothstep(0.010, 0.10, curvature) * slope;
      col += silver * (specular * 0.31 + grazing * 0.16 + crest * 0.15);

      vec2 objectDelta = uv - uObjectPos;
      objectDelta.x *= uResolution.x / max(1.0, uResolution.y);
      float objectShadow = exp(-dot(objectDelta, objectDelta) * 42.0);
      col *= 1.0 - objectShadow * (0.055 + uHover * 0.025);

      float vignette = smoothstep(0.86, 0.20, length(aspectP));
      col *= 0.80 + vignette * 0.34;

      float grain = (hash(gl_FragCoord.xy + uTime * 0.7) - 0.5) * 0.006;
      col += grain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
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

  const energy = 0.045 + hoverCurrent * 0.085;
  const offsetX = (Math.random() - 0.5) * 0.032;
  const offsetY = (Math.random() - 0.5) * 0.018;
  const [x, y] = objectUv(offsetX, offsetY);
  queueRipple(x, y, -energy, 0.021 + Math.random() * 0.009);

  if (hoverCurrent > 0.42 && Math.random() > 0.55) {
    queueRipple(
      x + (Math.random() - 0.5) * 0.024,
      y + (Math.random() - 0.5) * 0.014,
      energy * 0.52,
      0.015
    );
  }

  nextObjectPulse = now + (hoverCurrent > 0.25
    ? 850 + Math.random() * 850
    : 2100 + Math.random() * 1800);
}

function addObjectMotionRipple() {
  if (!waterReady || reducedMotion) return;
  const [x, y] = objectUv();
  const movement = Math.hypot(x - lastObjectX, y - lastObjectY);

  if (lastObjectX !== 0 && movement > 0.0007) {
    queueRipple(x, y, -Math.min(0.14, movement * 22), 0.020);
  }
  lastObjectX = x;
  lastObjectY = y;
}

function renderWater(now) {
  if (!waterReady) return;

  addObjectDisturbance(now);
  addObjectMotionRipple();

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
