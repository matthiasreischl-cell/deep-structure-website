import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const stage = document.getElementById('symbolStage');
const button = document.getElementById('enterButton');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Replace the first procedural approximation created by app.js.
// Its animation may continue off-DOM, but it is no longer visible.
for (const c of stage.querySelectorAll('canvas')) c.remove();
stage.style.transform = 'none';
stage.style.overflow = 'visible';

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Cold studio-like reflection made procedurally; no bitmap logo is used.
const env = document.createElement('canvas');
env.width = 512; env.height = 256;
const e = env.getContext('2d');
const g = e.createLinearGradient(0, 0, 0, env.height);
g.addColorStop(0, '#f2fcff');
g.addColorStop(.13, '#668b9c');
g.addColorStop(.38, '#0b1a22');
g.addColorStop(.7, '#020609');
g.addColorStop(1, '#244350');
e.fillStyle = g; e.fillRect(0, 0, env.width, env.height);
const envTexture = new THREE.CanvasTexture(env);
envTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envTexture;

// Extra framing fixes the clipping of the outer ring during tilt.
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
camera.position.set(0, 0, 7.95);

scene.add(new THREE.AmbientLight(0xa9c4d0, 1.0));
const top = new THREE.DirectionalLight(0xf2fcff, 2.7);
top.position.set(.1, 4.5, 5.2); scene.add(top);
const left = new THREE.DirectionalLight(0x6fbad6, .95);
left.position.set(-4, .8, 3.2); scene.add(left);
const right = new THREE.DirectionalLight(0x9beaff, 1.15);
right.position.set(4, -.4, 3); scene.add(right);
const lower = new THREE.PointLight(0xc5f3ff, 1.9, 11, 2);
lower.position.set(0, -2.1, 3); scene.add(lower);

const root = new THREE.Group();
scene.add(root);

const metal = new THREE.MeshPhysicalMaterial({
  color: 0x91aab7, metalness: .82, roughness: .24,
  clearcoat: .72, clearcoatRoughness: .17,
  envMapIntensity: 1.15, emissive: 0x051219, emissiveIntensity: .16
});
const bright = metal.clone();
bright.color = new THREE.Color(0xcbdde6);
bright.roughness = .17; bright.clearcoat = .9; bright.envMapIntensity = 1.35;
const dark = new THREE.MeshStandardMaterial({
  color: 0x071117, metalness: .28, roughness: .6,
  envMapIntensity: .35, side: THREE.DoubleSide
});
const black = new THREE.MeshStandardMaterial({
  color: 0x000204, metalness: .05, roughness: .95, side: THREE.DoubleSide
});

function extrude(shape, depth, bevel = .015, curves = 96) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelSegments: 2,
    bevelSize: bevel, bevelThickness: bevel, curveSegments: curves
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function annulus(inner, outer, depth, material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new THREE.Mesh(extrude(shape, depth, .012, 128), material);
}

const glow = new THREE.Mesh(
  new THREE.CircleGeometry(2.32, 96),
  new THREE.MeshBasicMaterial({
    color: 0x68cae4, transparent: true, opacity: .04,
    blending: THREE.AdditiveBlending, depthWrite: false
  })
);
glow.position.z = -.5; root.add(glow);

// Strictly follows the source mark: five flat metallic bands.
const radii = [1.42, 1.60, 1.78, 1.96, 2.14];
const band = .064;
radii.forEach((r, i) => {
  const ring = annulus(r - band / 2, r + band / 2, .086, i === 0 ? bright : metal);
  ring.position.z = -.02 - i * .008;
  root.add(ring);
});

// Dark inner circular field forms the blue-black side planes seen in the original.
const disc = new THREE.Mesh(new THREE.CircleGeometry(1.365, 128), dark);
disc.position.z = -.055; root.add(disc);

// Central element is a dark triangular face/void, not a bright wire triangle.
const triShape = new THREE.Shape();
triShape.moveTo(0, 1.16);
triShape.lineTo(-.98, -.57);
triShape.lineTo(.98, -.57);
triShape.closePath();
const triangle = new THREE.Mesh(extrude(triShape, .035, .004, 12), black);
triangle.position.z = .055; root.add(triangle);

// Metallic lower circular segment with straight upper chord.
const segR = 1.31, chordY = -.57;
const chordX = Math.sqrt(segR * segR - chordY * chordY);
const aR = Math.atan2(chordY, chordX);
const aL = -Math.PI - aR;
const seg = new THREE.Shape();
seg.moveTo(-chordX, chordY);
seg.lineTo(chordX, chordY);
for (let i = 0; i <= 80; i++) {
  const a = aR + (aL - aR) * i / 80;
  seg.lineTo(Math.cos(a) * segR, Math.sin(a) * segR);
}
seg.closePath();
const bowl = new THREE.Mesh(extrude(seg, .105, .016, 96), bright);
bowl.position.z = .08; root.add(bowl);
const chord = new THREE.Mesh(new THREE.BoxGeometry(chordX * 2, .024, .11), bright);
chord.position.set(0, chordY + .006, .105); root.add(chord);

let px = innerWidth / 2, py = innerHeight / 2;
let nx = 0, ny = 0, proximity = 0;
let rx = 0, ry = 0, x = 0, y = 0, z = 0;

function pointerState(ev) {
  px = ev.clientX; py = ev.clientY;
  const r = button.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height * .46;
  const radius = Math.max(1, Math.min(r.width, r.height) * .39);
  const dx = px - cx, dy = py - cy;
  nx = Math.max(-1, Math.min(1, dx / radius));
  ny = Math.max(-1, Math.min(1, dy / radius));
  const d = Math.hypot(dx, dy);
  proximity = d < radius ? 1 : Math.max(0, 1 - (d - radius) / (radius * .75));
}
addEventListener('pointermove', pointerState, { passive: true });
addEventListener('pointerleave', () => { proximity = 0; });

function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize, { passive: true });
resize();

function frame(now) {
  const t = now * .001;
  const idleFloat = reduced ? 0 : Math.sin(t * .92) * .043;
  const idleYaw = reduced ? 0 : Math.sin(t * .44) * .012;
  const targetRX = -ny * proximity * .17;
  const targetRY = nx * proximity * .21 + idleYaw;
  const targetX = nx * proximity * .085;
  const targetY = -ny * proximity * .06 + idleFloat;
  const targetZ = proximity * .095;

  rx += (targetRX - rx) * .075;
  ry += (targetRY - ry) * .075;
  x += (targetX - x) * .075;
  y += (targetY - y) * .075;
  z += (targetZ - z) * .075;

  root.rotation.set(rx, ry, Math.sin(t * .36) * .005);
  root.position.set(x, y, z);
  root.scale.setScalar(.985 + proximity * .015);
  glow.material.opacity = .035 + proximity * .03;
  lower.intensity = 1.85 + proximity * .7;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
