/*
  Deep Structure – Startseite als echte 3D-Szene.
  Das Logo (Metallringe als Tunnel, dunkles Dreieck, leuchtende Schale) schwimmt
  auf einer dunklen Wasserfläche, die es spiegelt (planare Spiegelung) und auf
  Logo, Maus und Finger mit Wellen reagiert.

  app.js bleibt zuständig für Klick, Übergang "The World you get in." und #inside.
  Schlägt WebGL2/Three.js fehl, lädt index.html automatisch die alte Variante.
*/
import * as THREE from './assets/vendor/three/three.module.min.js';

const button = document.getElementById('enterButton');
const stage = document.getElementById('symbolStage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

/* ---------- Renderer ---------- */
const canvas = document.createElement('canvas');
canvas.id = 'scene3d';
canvas.setAttribute('aria-hidden', 'true');
document.getElementById('fluid').after(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 nicht verfügbar');
renderer.setClearColor(0x010305, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.classList.add('scene3d');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 220);

/* ---------- Umgebung: dunkles Studio mit Lichtband oben (macht die Lichtkante auf den Ringen) ---------- */
function makeEnvironment() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#010306'; g.fillRect(0, 0, 1024, 512);
  let gr = g.createLinearGradient(0, 0, 0, 190);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#cfefff'); gr.addColorStop(0.6, '#2f6f8c'); gr.addColorStop(1, 'rgba(4,14,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 190);
  gr = g.createLinearGradient(0, 140, 0, 300);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(90,160,190,0.62)'); gr.addColorStop(0.7, 'rgba(40,90,115,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 140, 1024, 160);
  for (let i = 0; i < 4; i++) { // vier weiche Softboxen ringsum
    const x = 128 + i * 256, rg = g.createRadialGradient(x, 95, 0, x, 95, 90);
    rg.addColorStop(0, 'rgba(220,245,255,0.85)'); rg.addColorStop(1, 'rgba(220,245,255,0)');
    g.fillStyle = rg; g.fillRect(x - 90, 5, 180, 180);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture; tex.dispose(); pm.dispose();
  return env;
}
scene.environment = makeEnvironment();

scene.add(new THREE.AmbientLight(0x7aa7bd, 0.25));
const keyLight = new THREE.DirectionalLight(0xe8f8ff, 1.6); keyLight.position.set(0.4, 9, 4); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x6fc3e6, 0.7); rimLight.position.set(-6, 2, -3); scene.add(rimLight);

/* ---------- Logo-Geometrie (Maße aus der Vorlage, 1 px = R/240) ---------- */
const R = 2.3, PX = R / 240;
const logo = new THREE.Group();
const tilt = new THREE.Group(); // Neigung zur Maus, getrennt vom Schwimmen
tilt.add(logo); scene.add(tilt);

const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x9dbfd3, metalness: 1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.9, side: THREE.DoubleSide });
const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x03080c, metalness: 0.5, roughness: 0.42, envMapIntensity: 0.45, side: THREE.DoubleSide });
const triMat = new THREE.MeshPhysicalMaterial({ color: 0x0c1a23, metalness: 0.9, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.95 });

function ringGeometry(ri, ro, h) { // Ringband mit weich gerundetem Querschnitt, gedreht um die Blickachse
  const rc = (ri + ro) / 2, w = (ro - ri) / 2, pts = [], N = 48, se = v => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; pts.push(new THREE.Vector2(rc + w * se(Math.cos(a)), (h / 2) * se(Math.sin(a)))); }
  const geo = new THREE.LatheGeometry(pts, 192); geo.rotateX(Math.PI / 2); geo.computeVertexNormals(); return geo;
}
const RINGS = [[240, 224, 0.0], [214, 199, -0.12], [190, 176, -0.24], [167, 153, -0.36]];
const ringZ = [];
RINGS.forEach(([ro, ri, z]) => { const m = new THREE.Mesh(ringGeometry(ri * PX, ro * PX, 0.17), ringMat); m.position.z = z; logo.add(m); ringZ.push(z); });

const rIn = 151 * PX, discZ = -0.5;
const wall = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, 0.16, 160, 1, true), darkMat);
wall.rotation.x = Math.PI / 2; wall.position.z = discZ + 0.08; logo.add(wall);
const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 150, 10, 128, 128, 128); rg.addColorStop(0, '#000000'); rg.addColorStop(0.62, '#04090d'); rg.addColorStop(0.9, '#16303d'); rg.addColorStop(1, '#2b5568');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const disc = new THREE.Mesh(new THREE.CircleGeometry(rIn, 160), new THREE.MeshPhysicalMaterial({ color: 0x050b10, metalness: 0.4, roughness: 0.5, envMapIntensity: 0.4, emissive: 0xffffff, emissiveMap: discTex, emissiveIntensity: 0.55 }));
disc.position.z = discZ; logo.add(disc);

const chordY = -80 * PX, half = Math.sqrt(rIn * rIn - chordY * chordY);
const triShape = new THREE.Shape();
triShape.moveTo(0, rIn * 0.95); triShape.lineTo(-half * 0.95, chordY + 0.035); triShape.lineTo(half * 0.95, chordY + 0.035); triShape.closePath();
const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 4 });
const tri = new THREE.Mesh(triGeo, triMat); tri.position.z = discZ + 0.02; logo.add(tri);
const edgeShape = new THREE.Shape(triShape.getPoints()), inset = 0.045;
const tA = new THREE.Vector2(0, rIn * 0.95), tB = new THREE.Vector2(-half * 0.95, chordY + 0.035), tC = new THREE.Vector2(half * 0.95, chordY + 0.035);
const cen = new THREE.Vector2((tA.x + tB.x + tC.x) / 3, (tA.y + tB.y + tC.y) / 3), shrink = v => v.clone().sub(cen).multiplyScalar(1 - inset * 3.2 / cen.distanceTo(v)).add(cen);
edgeShape.holes.push(new THREE.Path([shrink(tA), shrink(tC), shrink(tB)]));
const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x6f93a8, metalness: 1, roughness: 0.22, clearcoat: 0.6, envMapIntensity: 1.3, emissive: 0x0d2a38, emissiveIntensity: 0.6 });
const triEdge = new THREE.Mesh(new THREE.ExtrudeGeometry(edgeShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 3 }), edgeMat);
triEdge.position.z = discZ + 0.02; logo.add(triEdge);

// leuchtende Schale unter dem Dreieck
const bowlShape = new THREE.Shape(), ra = rIn * 0.975, aR = Math.atan2(chordY, half);
bowlShape.moveTo(-half * 0.975, chordY); bowlShape.lineTo(half * 0.975, chordY);
bowlShape.absarc(0, 0, ra, aR, -Math.PI - aR, true);
bowlShape.closePath();
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const cy = (chordY / (2 * rIn) + 0.5); const y = (1 - cy) * 256;
  const rg = g.createRadialGradient(128, y, 4, 128, y, 190); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.18, '#bfeaff'); rg.addColorStop(0.5, '#3d8db0'); rg.addColorStop(1, '#0b2b3a');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / (2 * rIn), 1 / (2 * rIn)); t.offset.set(0.5, 0.5); return t; })();
const bowlMat = new THREE.MeshPhysicalMaterial({ color: 0xa9d6ea, metalness: 0.9, roughness: 0.16, clearcoat: 1, envMapIntensity: 1.2, emissive: 0xffffff, emissiveMap: glowTex, emissiveIntensity: 0.75 });
const bowl = new THREE.Mesh(new THREE.ExtrudeGeometry(bowlShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 96 }), bowlMat);
bowl.position.z = discZ + 0.02; logo.add(bowl);
const chordLine = new THREE.Mesh(new THREE.BoxGeometry(half * 1.9, 0.016, 0.02), new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false }));
chordLine.position.set(0, chordY + 0.004, discZ + 0.14); logo.add(chordLine);
const bowlLight = new THREE.PointLight(0x9fe2ff, 3.2, 3.2, 1.6); bowlLight.position.set(0, chordY - 0.15, discZ + 0.6); logo.add(bowlLight);

/* Lichtreflexe als weiche Sprites (wie das Licht in der Vorlage) */
const spriteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.2, 'rgba(200,240,255,0.55)'); rg.addColorStop(0.55, 'rgba(110,190,230,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
function glow(x, y, z, sx, sy, op, color = 0xbfeaff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.position.set(x, y, z); s.scale.set(sx, sy, 1); logo.add(s); return s;
}
const halo = glow(0, 0.25, -0.9, 7.2, 7.2, 0.10, 0x4fa9cf);
const beam = glow(0, R * 0.98, 0.15, 0.32, 2.4, 0.55);
const topSpot = glow(0, R * 0.98, 0.18, 1.3, 0.55, 0.75);
const ringSpots = RINGS.slice(1).map(([ro, ri, z]) => glow(0, (ro + ri) / 2 * PX, z + 0.1, 0.55, 0.16, 0.55));
const flare = glow(0, chordY + 0.01, discZ + 0.22, 2.9, 0.16, 0.85, 0xdff6ff);
const flareCore = glow(0, chordY + 0.01, discZ + 0.24, 0.65, 0.65, 0.9, 0xffffff);

/* ---------- Wasser mit planarer Spiegelung ---------- */
const MAXR = 10;
const ripples = Array.from({ length: MAXR }, () => new THREE.Vector4(0, 0, -100, 0));
let ripIdx = 0;
const reflTarget = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 0 });
const waterUniforms = {
  tReflect: { value: reflTarget.texture }, textureMatrix: { value: new THREE.Matrix4() }, uTime: { value: 0 },
  uRip: { value: ripples }, uContact: { value: 0.3 }, uLogo: { value: new THREE.Vector2(0, 0) }, uGlow: { value: 1 },
  uLightPos: { value: new THREE.Vector3(0, 3.5, 1.2) }
};
const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vProj; varying vec3 vWorld;
    void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vProj = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tReflect; uniform float uTime; uniform vec4 uRip[${MAXR}]; uniform float uContact; uniform vec2 uLogo; uniform float uGlow; uniform vec3 uLightPos;
    varying vec4 vProj; varying vec3 vWorld;
    float waves(vec2 p, float t){
      float h = 0.0;
      h += sin(dot(p, vec2(0.80, 0.60)) * 0.9 + t * 0.70) * 0.050;
      h += sin(dot(p, vec2(-0.50, 0.86)) * 1.5 - t * 0.95) * 0.026;
      h += sin(dot(p, vec2(0.97, -0.24)) * 2.6 + t * 1.25) * 0.012;
      h += sin(dot(p, vec2(-0.21, -0.98)) * 4.1 - t * 1.60) * 0.006;
      h += sin(dot(p, vec2(0.60, -0.80)) * 6.3 + t * 2.05) * 0.003;
      return h;
    }
    float rings(vec2 p, float t){
      float h = 0.0;
      for (int i = 0; i < ${MAXR}; i++){
        vec4 r = uRip[i]; float age = t - r.z; if (age < 0.0 || age > 10.0 || r.w <= 0.0) continue;
        float d = length(p - r.xy); float x = d - age * 1.35;
        h += sin(x * 6.5) * exp(-x * x * 1.2) * exp(-age * 0.42) * r.w * 0.08 / (1.0 + d * 0.45);
      }
      vec2 q = p - uLogo; q.y *= 1.6; float dc = length(q);
      h += sin(dc * 5.0 - t * 2.4) * exp(-dc * 0.42) * smoothstep(0.15, 1.0, dc) * uContact * 0.045;
      h -= exp(-dc * dc * 1.5) * 0.05; // Mulde unter dem schwimmenden Logo
      return h;
    }
    float H(vec2 p){ return waves(p, uTime) + rings(p, uTime); }
    void main(){
      vec2 p = vWorld.xz; vec3 toEye = cameraPosition - vWorld; float dist = length(toEye); vec3 V = toEye / dist;
      float e = 0.025 + dist * 0.0025;
      float h = H(p);
      vec3 n = normalize(vec3(H(p - vec2(e, 0.0)) - H(p + vec2(e, 0.0)), 2.0 * e, H(p - vec2(0.0, e)) - H(p + vec2(0.0, e))));
      n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(18.0, 60.0, dist)));
      float ndv = max(dot(n, V), 0.0);
      float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
      vec4 pc = vProj; pc.xy += n.xz * 0.9 * pc.w * 0.12;
      vec3 refl = texture2DProj(tReflect, pc).rgb;
      vec3 deep = vec3(0.0015, 0.0085, 0.012), petrol = vec3(0.006, 0.040, 0.050);
      vec3 col = mix(deep, petrol, clamp(0.45 + h * 5.0, 0.0, 1.0) * 0.55);
      vec3 R = reflect(-V, n);
      vec3 sky = mix(vec3(0.003, 0.012, 0.017), vec3(0.020, 0.075, 0.095), pow(max(R.y, 0.0), 0.7));
      col = mix(col, sky, fres);
      col += refl * (0.42 + fres * 0.9);
      vec3 L = uLightPos - vWorld; float ld = length(L); L /= ld; vec3 Hh = normalize(L + V);
      col += vec3(0.55, 0.86, 1.0) * pow(max(dot(n, Hh), 0.0), 160.0) * 2.2 / (1.0 + 0.04 * ld * ld);
      col += vec3(0.20, 0.55, 0.70) * pow(max(dot(n, Hh), 0.0), 18.0) * 0.07 / (1.0 + 0.08 * ld * ld);
      float dl = length((vWorld.xz - uLogo) * vec2(0.6, 1.0));
      col += vec3(0.020, 0.075, 0.095) * exp(-dl * 0.5) * uGlow;
      col = mix(col, vec3(0.0018, 0.0075, 0.010), smoothstep(14.0, 55.0, dist));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
}));
water.rotation.x = -Math.PI / 2;
scene.add(water);

// Spiegelkamera (nach dem Prinzip von THREE.Reflector, mit schiefer Nahebene)
const vCam = new THREE.PerspectiveCamera();
const _n = new THREE.Vector3(), _rp = new THREE.Vector3(), _cp = new THREE.Vector3(), _rot = new THREE.Matrix4(), _look = new THREE.Vector3(),
  _view = new THREE.Vector3(), _tgt = new THREE.Vector3(), _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q = new THREE.Vector4();
function renderReflection() {
  _rp.setFromMatrixPosition(water.matrixWorld); _cp.setFromMatrixPosition(camera.matrixWorld);
  _rot.extractRotation(water.matrixWorld); _n.set(0, 0, 1).applyMatrix4(_rot);
  _view.subVectors(_rp, _cp); if (_view.dot(_n) > 0) return;
  _view.reflect(_n).negate().add(_rp);
  _rot.extractRotation(camera.matrixWorld); _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
  _tgt.subVectors(_rp, _look).reflect(_n).negate().add(_rp);
  vCam.position.copy(_view); vCam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n); vCam.lookAt(_tgt);
  vCam.far = camera.far; vCam.updateMatrixWorld(); vCam.projectionMatrix.copy(camera.projectionMatrix);
  const tm = waterUniforms.textureMatrix.value;
  tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vCam.projectionMatrix).multiply(vCam.matrixWorldInverse).multiply(water.matrixWorld);
  _plane.setFromNormalAndCoplanarPoint(_n, _rp).applyMatrix4(vCam.matrixWorldInverse);
  _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
  const pm = vCam.projectionMatrix.elements;
  _q.x = (Math.sign(_clip.x) + pm[8]) / pm[0]; _q.y = (Math.sign(_clip.y) + pm[9]) / pm[5]; _q.z = -1; _q.w = (1 + pm[10]) / pm[14];
  _clip.multiplyScalar(2 / _clip.dot(_q));
  pm[2] = _clip.x; pm[6] = _clip.y; pm[10] = _clip.z + 1 - 0.003; pm[14] = _clip.w;
  water.visible = false; beam.visible = false; halo.visible = false;
  renderer.setRenderTarget(reflTarget); renderer.clear(); renderer.render(scene, vCam); renderer.setRenderTarget(null);
  water.visible = true; beam.visible = true; halo.visible = true;
}

/* ---------- Kamera an das HTML-Layout anpassen (Logo sitzt dort, wo die Bühne ist) ---------- */
let baseY = R * 0.9;
function fit() {
  const W = innerWidth, Hh = innerHeight, dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.6);
  renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false);
  reflTarget.setSize(Math.max(256, Math.round(W * dpr * 0.5)), Math.max(256, Math.round(Hh * dpr * 0.5)));
  const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const rpx = Math.max(60, r.width * (W < 760 ? 0.47 : 0.41));
  camera.fov = 30; camera.aspect = W / Hh;
  const L = R * Hh / (2 * rpx * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const pitch = 0.27;
  camera.position.set(0, baseY + L * Math.sin(pitch), L * Math.cos(pitch));
  camera.lookAt(0, baseY, 0);
  camera.setViewOffset(W, Hh, W / 2 - cx, Hh / 2 - cy, W, Hh);
  camera.updateProjectionMatrix();
}
fit();
addEventListener('resize', fit, { passive: true });

/* ---------- Wellen auslösen ---------- */
const clock = { t: 0 };
function addRipple(x, z, strength) { ripples[ripIdx].set(x, z, clock.t, strength); ripIdx = (ripIdx + 1) % MAXR; }

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const logoMeshes = []; logo.traverse(o => { if (o.isMesh) logoMeshes.push(o); });
const ptr = { x: 0, y: 0, inside: false, onLogo: false, lastX: 1e9, lastZ: 1e9, lastT: 0, sx: 0, sy: 0, speed: 0 };
function pointerToWorld(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  ptr.onLogo = ray.intersectObjects(logoMeshes, false).length > 0;
  return ray.ray.intersectPlane(waterPlane, hit) ? hit : null;
}
addEventListener('pointermove', e => {
  if (document.body.classList.contains('entered')) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.inside = true;
  ptr.speed = Math.min(1, Math.hypot(dx, dy) / 40);
  const w = pointerToWorld(e.clientX, e.clientY);
  if (!w || ptr.onLogo || reduced) return;
  const moved = Math.hypot(w.x - ptr.lastX, w.z - ptr.lastZ);
  if (moved > 0.45 && clock.t - ptr.lastT > 0.08) { addRipple(w.x, w.z, 0.25 + ptr.speed * 0.9); ptr.lastX = w.x; ptr.lastZ = w.z; ptr.lastT = clock.t; }
}, { passive: true });
addEventListener('pointerleave', () => { ptr.inside = false; });
addEventListener('pointerdown', e => {
  if (document.body.classList.contains('entered')) return;
  const w = pointerToWorld(e.clientX, e.clientY);
  if (w && !ptr.onLogo) addRipple(w.x, w.z, 1.2);
}, { passive: true });

/* Klick aufs Logo: es taucht kurz ein, große Welle, mehr Licht */
const body = { y: 0, v: 0, flash: 0 };
button.addEventListener('click', () => { body.v -= 0.9; body.flash = 1; addRipple(0, 0.2, 2.2); setTimeout(() => addRipple(0, 0.2, 1.4), 380); });

/* ---------- Animation ---------- */
let rx = 0, ry = 0, prox = 0, frameId = 0, last = performance.now();
function frame(now) {
  frameId = 0;
  if (document.hidden || document.body.classList.contains('entered')) return;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); clock.t += reduced ? 0 : dt;
  const t = clock.t;

  // Schwimmen: Feder + Wellengang
  const target = reduced ? 0 : Math.sin(t * 0.8) * 0.045 + Math.sin(t * 1.37 + 1.1) * 0.02;
  body.v += (-(body.y - target) * 9 - body.v * 2.6) * dt; body.y += body.v * dt;
  body.flash *= Math.exp(-dt * 1.6);
  logo.position.y = baseY + body.y;
  logo.rotation.z = reduced ? 0 : Math.sin(t * 0.63) * 0.022 + Math.sin(t * 1.11) * 0.008;

  // Neigung zur Maus (auf Touch nur Schwimmen)
  const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.5;
  let nx = 0, ny = 0, p = 0;
  if (ptr.inside && !coarse) { nx = clamp((ptr.x - cx) / rad, -1.3, 1.3); ny = clamp((ptr.y - cy) / rad, -1.3, 1.3); const d = Math.hypot(ptr.x - cx, ptr.y - cy); p = d < rad ? 1 : Math.max(0, 1 - (d - rad) / (rad * 1.4)); }
  prox += (p - prox) * Math.min(1, dt * 3);
  const idlePitch = reduced ? 0 : Math.sin(t * 0.77 + 1) * 0.035;
  rx += ((ny * 0.30 * prox + idlePitch) - rx) * Math.min(1, dt * 2.6);
  ry += ((nx * 0.42 * prox + (reduced ? 0 : Math.sin(t * 0.41) * 0.05)) - ry) * Math.min(1, dt * 2.6);
  tilt.rotation.set(rx, ry, 0);
  tilt.position.set(0, 0, 0);

  // Licht und Wasserkontakt
  const shine = 1 + prox * 0.35 + body.flash * 0.8;
  beam.material.opacity = 0.5 * shine; topSpot.material.opacity = 0.7 * shine; flare.material.opacity = 0.8 * shine; flareCore.material.opacity = 0.85 * shine;
  halo.material.opacity = 0.09 + prox * 0.05 + body.flash * 0.12;
  bowlMat.emissiveIntensity = 0.7 + prox * 0.2 + body.flash * 0.6;
  ringSpots.forEach((s, i) => s.material.opacity = 0.45 * shine * (1 - i * 0.12));
  waterUniforms.uTime.value = t;
  waterUniforms.uContact.value = 0.35 + Math.min(1.5, Math.abs(body.v) * 6) + prox * 0.4;
  waterUniforms.uGlow.value = 1 + prox * 0.5 + body.flash;
  waterUniforms.uLightPos.value.set(0, logo.position.y + 1.3, 1.5);

  scene.updateMatrixWorld();
  renderReflection();
  renderer.render(scene, camera);
  if (!reduced) frameId = requestAnimationFrame(frame);
}
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
addEventListener('visibilitychange', () => { if (!document.hidden && !frameId && !document.body.classList.contains('entered')) { last = performance.now(); frameId = requestAnimationFrame(frame); } });
addEventListener('hashchange', () => { if (location.hash !== '#inside' && !frameId) { last = performance.now(); frameId = requestAnimationFrame(frame); } });
frameId = requestAnimationFrame(frame);
window.__dsLanding3D = { addRipple, fit };
