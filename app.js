import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const canvas = document.getElementById('fluid');
const button = document.getElementById('enterButton');
const transition = document.getElementById('transition');
const inside = document.getElementById('inside');
const compass = document.getElementById('compass');
const symbolStage = document.getElementById('symbolStage');
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
  const radius = Math.min(rect.width, rect.height) * 0.42;
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
  resizeThree();
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

function enter() {
  if (entering) return;
  entering = true;
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

// ===== Dark water shader =====
const gl = canvas.getContext('webgl', {
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance'
});

let waterProgram = null;
let waterLocations = null;
const waterStart = performance.now();

if (gl) {
  const vertexSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uPointer;
    uniform vec2 uObjectPos;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uHover;

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
      float v = 0.0;
      float a = 0.52;
      mat2 r = mat2(0.82, -0.57, 0.57, 0.82);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.05 + 17.1;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      vec2 p = uv - 0.5;
      p.x *= uResolution.x / uResolution.y;

      vec2 pointer = uPointer / uResolution.xy - 0.5;
      pointer.x *= uResolution.x / uResolution.y;

      vec2 objectPos = uObjectPos / uResolution.xy - 0.5;
      objectPos.x *= uResolution.x / uResolution.y;

      float t = uTime * 0.23;
      float macro = fbm(p * 2.4 + vec2(t * 0.32, -t * 0.21));
      float micro = fbm(p * 7.2 - vec2(t * 0.12, t * 0.28));
      float diagonal = sin((p.x + p.y) * 10.5 - uTime * 0.55) * 0.035;

      float objectDist = length(p - objectPos);
      float pointerDist = length(p - pointer);

      // The object permanently displaces the surface.
      float basin = exp(-objectDist * 7.2) * (0.14 + uHover * 0.22);
      float objectRipples = sin(objectDist * 42.0 - uTime * (2.4 + uHover * 2.1))
        * exp(-objectDist * (4.6 - uHover * 1.8))
        * (0.11 + uHover * 0.26);

      // The compass creates additional local ripples.
      float pointerRipples = sin(pointerDist * 56.0 - uTime * (4.0 + uSpeed * 4.4))
        * exp(-pointerDist * 8.1)
        * (0.02 + uSpeed * 0.19 + uHover * 0.08);

      vec2 current = p + vec2(
        sin((p.y + micro * 0.22) * 15.5 + uTime * 0.24),
        cos((p.x - macro * 0.28) * 14.2 - uTime * 0.22)
      ) * 0.016;

      float fluid = fbm(current * 4.6 + macro * 0.75) + diagonal;
      float wave = fluid + objectRipples + pointerRipples - basin;
      float highlights = smoothstep(0.45, 0.92, wave + macro * 0.14);
      float objectHalo = exp(-objectDist * 5.2) * (0.09 + uHover * 0.12);
      float pointerHalo = exp(-pointerDist * 9.0) * (0.02 + uSpeed * 0.06);
      float vignette = 1.0 - smoothstep(0.1, 0.98, length(p));

      vec3 black = vec3(0.002, 0.007, 0.011);
      vec3 deep = vec3(0.014, 0.05, 0.065);
      vec3 cyan = vec3(0.23, 0.72, 0.82);
      vec3 silver = vec3(0.78, 0.9, 0.96);

      vec3 col = mix(black, deep, 0.34 + wave * 0.55 + macro * 0.16);
      col += cyan * max(objectRipples, 0.0) * 0.18;
      col += cyan * max(pointerRipples, 0.0) * 0.14;
      col += silver * highlights * 0.085;
      col += cyan * objectHalo;
      col += silver * pointerHalo;
      col *= 0.58 + vignette * 0.54;

      float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.016;
      col += grain;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

  if (vertexShader && fragmentShader) {
    waterProgram = gl.createProgram();
    gl.attachShader(waterProgram, vertexShader);
    gl.attachShader(waterProgram, fragmentShader);
    gl.linkProgram(waterProgram);

    if (gl.getProgramParameter(waterProgram, gl.LINK_STATUS)) {
      gl.useProgram(waterProgram);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1
      ]), gl.STATIC_DRAW);

      const position = gl.getAttribLocation(waterProgram, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      waterLocations = {
        resolution: gl.getUniformLocation(waterProgram, 'uResolution'),
        pointer: gl.getUniformLocation(waterProgram, 'uPointer'),
        objectPos: gl.getUniformLocation(waterProgram, 'uObjectPos'),
        time: gl.getUniformLocation(waterProgram, 'uTime'),
        speed: gl.getUniformLocation(waterProgram, 'uSpeed'),
        hover: gl.getUniformLocation(waterProgram, 'uHover')
      };
    }
  }
}

function resizeWater() {
  if (!gl) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
resizeWater();

function renderWater(now) {
  if (!gl || !waterProgram || !waterLocations) return;

  const dprX = canvas.width / innerWidth;
  const dprY = canvas.height / innerHeight;
  const objectX = rect.left + rect.width * 0.5;
  const objectY = rect.top + rect.height * 0.46;

  gl.useProgram(waterProgram);
  gl.uniform2f(waterLocations.resolution, canvas.width, canvas.height);
  gl.uniform2f(waterLocations.pointer, pointerX * dprX, (innerHeight - pointerY) * dprY);
  gl.uniform2f(waterLocations.objectPos, objectX * dprX, (innerHeight - objectY) * dprY);
  gl.uniform1f(waterLocations.time, (now - waterStart) / 1000);
  gl.uniform1f(waterLocations.speed, speed);
  gl.uniform1f(waterLocations.hover, hoverCurrent);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ===== Real Three.js Deep Structure symbol =====
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x000000, 0);
symbolStage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Procedural environment: the 3D symbol uses no logo image/texture.
const envCanvas = document.createElement('canvas');
envCanvas.width = 512;
envCanvas.height = 256;
const envCtx = envCanvas.getContext('2d');
const envGradient = envCtx.createLinearGradient(0, 0, 0, envCanvas.height);
envGradient.addColorStop(0.00, '#dff8ff');
envGradient.addColorStop(0.14, '#557f92');
envGradient.addColorStop(0.42, '#09151c');
envGradient.addColorStop(0.72, '#02070b');
envGradient.addColorStop(1.00, '#17313e');
envCtx.fillStyle = envGradient;
envCtx.fillRect(0, 0, envCanvas.width, envCanvas.height);
const envTexture = new THREE.CanvasTexture(envCanvas);
envTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envTexture;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
camera.position.set(0, 0, 6.2);

const ambient = new THREE.AmbientLight(0xbfd8e5, 1.35);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xe8fbff, 2.35);
keyLight.position.set(2.4, 2.2, 4.2);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x6fc8ff, 1.2);
fillLight.position.set(-3.4, -1.4, 2.5);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x91e4ff, 1.9, 10, 2);
rimLight.position.set(0, 1.2, 3.1);
scene.add(rimLight);

const symbolRoot = new THREE.Group();
scene.add(symbolRoot);

const metal = new THREE.MeshPhysicalMaterial({
  color: 0xaabccc,
  metalness: 1,
  roughness: 0.24,
  clearcoat: 0.72,
  clearcoatRoughness: 0.16,
  reflectivity: 1,
  sheen: 0.18,
  sheenColor: new THREE.Color(0xeafaff),
  emissive: 0x09131b,
  emissiveIntensity: 0.22
});

const accent = metal.clone();
accent.color = new THREE.Color(0xdeeef8);
accent.roughness = 0.18;
accent.clearcoat = 0.85;
accent.emissive = new THREE.Color(0x0b1e26);
accent.emissiveIntensity = 0.25;

const glowDisc = new THREE.Mesh(
  new THREE.CircleGeometry(2.1, 80),
  new THREE.MeshBasicMaterial({
    color: 0x7edfff,
    transparent: true,
    opacity: 0.09,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
glowDisc.position.z = -0.95;
symbolRoot.add(glowDisc);

function makeTubeFromPoints(points, radius, tubularSegments, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal', 0.45);
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 18, closed);
  return new THREE.Mesh(geometry, material);
}

// Five concentric metallic rings reconstructed as geometry.
for (let i = 0; i < 5; i++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.38 + i * 0.19, 0.035, 18, 140),
    i === 0 ? accent : metal
  );
  ring.position.z = -0.18 + i * 0.02;
  symbolRoot.add(ring);
}

// Inner triangular form.
const trianglePoints = [
  new THREE.Vector3(0, 0.95, 0.15),
  new THREE.Vector3(-0.86, -0.5, 0.1),
  new THREE.Vector3(0.86, -0.5, 0.1)
];
const triangle = makeTubeFromPoints(trianglePoints, 0.07, 220, accent, true);
symbolRoot.add(triangle);

// Lower curved element.
const arcCurve = new THREE.EllipseCurve(0, -0.1, 0.93, 0.34, Math.PI, 0, true, 0);
const arcPoints2D = arcCurve.getPoints(100);
const arcPoints = arcPoints2D.map((p) => new THREE.Vector3(p.x, p.y, 0.12));
const arc = makeTubeFromPoints(arcPoints, 0.08, 180, accent, false);
symbolRoot.add(arc);

const baseGlow = new THREE.Mesh(
  new THREE.RingGeometry(0.72, 1.05, 72),
  new THREE.MeshBasicMaterial({
    color: 0x7edfff,
    transparent: true,
    opacity: 0.09,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
baseGlow.rotation.x = Math.PI;
baseGlow.position.set(0, -0.22, 0.02);
symbolRoot.add(baseGlow);

let symbolTargetRotX = 0;
let symbolTargetRotY = 0;
let symbolRotX = 0;
let symbolRotY = 0;
let symbolX = 0;
let symbolY = 0;
let symbolZ = 0;

function resizeThree() {
  const width = Math.max(1, symbolStage.clientWidth);
  const height = Math.max(1, symbolStage.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
resizeThree();

refreshRect();
updateHoverState();

function animate(now) {
  applyCssMotion();
  refreshRect();
  updateHoverState();

  const t = now * 0.001;
  const idleFloat = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.06;
  const idleSway = reducedMotion ? 0 : Math.sin(t * 0.45) * 0.04;

  symbolTargetRotX = (-cursorState.normY * hoverCurrent * 0.28) + idleSway * 0.4;
  symbolTargetRotY = (cursorState.normX * hoverCurrent * 0.36) + Math.sin(t * 0.7) * 0.05;

  symbolRotX += (symbolTargetRotX - symbolRotX) * 0.08;
  symbolRotY += (symbolTargetRotY - symbolRotY) * 0.08;
  symbolX += ((cursorState.normX * hoverCurrent * 0.18) - symbolX) * 0.08;
  symbolY += (((-cursorState.normY * hoverCurrent * 0.12) + idleFloat) - symbolY) * 0.08;
  symbolZ += (((hoverCurrent * 0.24) + Math.sin(t * 1.2) * 0.03) - symbolZ) * 0.08;

  symbolRoot.rotation.x = symbolRotX;
  symbolRoot.rotation.y = symbolRotY;
  symbolRoot.rotation.z = Math.sin(t * 0.55) * 0.03 * (0.5 + hoverCurrent * 0.5);
  symbolRoot.position.x = symbolX;
  symbolRoot.position.y = symbolY;
  symbolRoot.position.z = symbolZ;
  symbolRoot.scale.setScalar(1 + hoverCurrent * 0.04);

  glowDisc.material.opacity = 0.07 + hoverCurrent * 0.06;
  baseGlow.material.opacity = 0.08 + hoverCurrent * 0.08;
  rimLight.intensity = 1.7 + hoverCurrent * 1.1;

  renderWater(now);
  renderer.render(scene, camera);
  speed *= 0.92;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
