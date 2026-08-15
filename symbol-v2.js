import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const stage = document.getElementById('symbolStage');
const button = document.getElementById('enterButton');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Replace the earlier procedural approximation created by app.js.
// app.js continues to own the water shader, compass cursor and entrance transition.
for (const canvas of stage.querySelectorAll('canvas')) canvas.remove();

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

// Restrained cold studio reflection. No bitmap logo is used.
const env = document.createElement('canvas');
env.width = 512;
env.height = 256;
const envCtx = env.getContext('2d');
const envGradient = envCtx.createLinearGradient(0, 0, 0, env.height);
envGradient.addColorStop(0.00, '#f4fcff');
envGradient.addColorStop(0.12, '#7896a4');
envGradient.addColorStop(0.35, '#12232b');
envGradient.addColorStop(0.70, '#020609');
envGradient.addColorStop(1.00, '#1d3540');
envCtx.fillStyle = envGradient;
envCtx.fillRect(0, 0, env.width, env.height);

const envTexture = new THREE.CanvasTexture(env);
envTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envTexture;

// Generous framing keeps the outer ring visible even at maximum tilt.
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, 9.35);

scene.add(new THREE.AmbientLight(0xa9c4d0, 0.92));

const topLight = new THREE.DirectionalLight(0xf3fcff, 2.45);
topLight.position.set(0.15, 4.6, 5.6);
scene.add(topLight);

const leftLight = new THREE.DirectionalLight(0x6fbad6, 0.72);
leftLight.position.set(-4.2, 0.8, 3.4);
scene.add(leftLight);

const rightLight = new THREE.DirectionalLight(0xa6e9ff, 0.88);
rightLight.position.set(4.1, -0.5, 3.2);
scene.add(rightLight);

const lowerLight = new THREE.PointLight(0xc8f2ff, 1.35, 12, 2);
lowerLight.position.set(0, -2.2, 3.3);
scene.add(lowerLight);

const root = new THREE.Group();
scene.add(root);

// Materials stay shallow and controlled so the mark retains its 2D identity.
const ringMetal = new THREE.MeshPhysicalMaterial({
  color: 0xa7bac4,
  metalness: 0.80,
  roughness: 0.25,
  clearcoat: 0.62,
  clearcoatRoughness: 0.19,
  envMapIntensity: 1.08,
  emissive: 0x061218,
  emissiveIntensity: 0.10
});

const brightMetal = new THREE.MeshPhysicalMaterial({
  color: 0xd7e4ea,
  metalness: 0.76,
  roughness: 0.19,
  clearcoat: 0.74,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.18,
  emissive: 0x08151a,
  emissiveIntensity: 0.08
});

const innerDark = new THREE.MeshStandardMaterial({
  color: 0x020609,
  metalness: 0.12,
  roughness: 0.88,
  envMapIntensity: 0.14,
  side: THREE.DoubleSide
});

function extrude(shape, depth, bevel = 0.008, curves = 128) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: curves
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function annulus(innerRadius, outerRadius, depth, material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return new THREE.Mesh(extrude(shape, depth, 0.006, 160), material);
}

// Very subtle contact glow; geometry remains visually dominant.
const glow = new THREE.Mesh(
  new THREE.CircleGeometry(2.34, 128),
  new THREE.MeshBasicMaterial({
    color: 0x67c5df,
    transparent: true,
    opacity: 0.022,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
glow.position.z = -0.32;
root.add(glow);

// FOUR concentric metallic ring bands, derived from the supplied reference.
const ringRadii = [1.34, 1.60, 1.87, 2.14];
const ringBandWidth = 0.132;
const ringDepth = 0.050;

ringRadii.forEach((radius, index) => {
  const ring = annulus(
    radius - ringBandWidth / 2,
    radius + ringBandWidth / 2,
    ringDepth,
    index === 0 ? brightMetal : ringMetal
  );
  ring.position.z = -0.020 - index * 0.004;
  root.add(ring);
});

// The opening inside the innermost ring remains almost black.
const openingRadius = 1.265;
const darkDisc = new THREE.Mesh(
  new THREE.CircleGeometry(openingRadius, 160),
  innerDark
);
darkDisc.position.z = -0.052;
root.add(darkDisc);

/*
Central filled triangle.
The triangle is deliberately separated from the lower circular segment:
all three sides, including the complete lower edge, remain freely visible.
*/
const triangleShape = new THREE.Shape();
triangleShape.moveTo(0, 1.12);
triangleShape.lineTo(-0.98, -0.44);
triangleShape.lineTo(0.98, -0.44);
triangleShape.closePath();

const triangle = new THREE.Mesh(
  extrude(triangleShape, 0.050, 0.006, 16),
  brightMetal
);
triangle.position.z = 0.032;
root.add(triangle);

/*
Lower filled circular segment.
Its straight upper chord sits well below the triangle base, leaving a clearly
visible dark separation zone. It never touches or overlaps the triangle.
*/
const segmentRadius = 1.08;
const chordY = -0.74;
const chordX = Math.sqrt(segmentRadius * segmentRadius - chordY * chordY);
const rightAngle = Math.atan2(chordY, chordX);
const leftAngle = -Math.PI - rightAngle;

const segmentShape = new THREE.Shape();
segmentShape.moveTo(-chordX, chordY);
segmentShape.lineTo(chordX, chordY);

for (let i = 0; i <= 120; i++) {
  const angle = rightAngle + (leftAngle - rightAngle) * (i / 120);
  segmentShape.lineTo(
    Math.cos(angle) * segmentRadius,
    Math.sin(angle) * segmentRadius
  );
}
segmentShape.closePath();

const lowerSegment = new THREE.Mesh(
  extrude(segmentShape, 0.052, 0.007, 128),
  brightMetal
);
lowerSegment.position.z = 0.034;
root.add(lowerSegment);

// Clean straight upper edge of the lower segment.
const chord = new THREE.Mesh(
  new THREE.BoxGeometry(chordX * 2, 0.018, 0.055),
  brightMetal
);
chord.position.set(0, chordY + 0.005, 0.044);
root.add(chord);

// Pointer-driven motion remains intentionally subtle.
let nx = 0;
let ny = 0;
let proximity = 0;

let rx = 0;
let ry = 0;
let px = 0;
let py = 0;
let pz = 0;

function updatePointer(event) {
  const rect = button.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.46;
  const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.39);

  const dx = event.clientX - cx;
  const dy = event.clientY - cy;

  nx = Math.max(-1, Math.min(1, dx / radius));
  ny = Math.max(-1, Math.min(1, dy / radius));

  const distance = Math.hypot(dx, dy);
  proximity = distance < radius
    ? 1
    : Math.max(0, 1 - (distance - radius) / (radius * 0.80));
}

addEventListener('pointermove', updatePointer, { passive: true });
addEventListener('pointerleave', () => {
  proximity = 0;
});

function resize() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

addEventListener('resize', resize, { passive: true });
resize();

function frame(now) {
  const time = now * 0.001;

  const idleFloat = reduced ? 0 : Math.sin(time * 0.82) * 0.030;
  const idleYaw = reduced ? 0 : Math.sin(time * 0.38) * 0.006;

  const targetRX = -ny * proximity * 0.080;
  const targetRY = nx * proximity * 0.105 + idleYaw;
  const targetX = nx * proximity * 0.040;
  const targetY = -ny * proximity * 0.030 + idleFloat;
  const targetZ = proximity * 0.045;

  rx += (targetRX - rx) * 0.070;
  ry += (targetRY - ry) * 0.070;
  px += (targetX - px) * 0.070;
  py += (targetY - py) * 0.070;
  pz += (targetZ - pz) * 0.070;

  root.rotation.set(rx, ry, 0);
  root.position.set(px, py, pz);
  root.scale.setScalar(0.94 + proximity * 0.008);

  glow.material.opacity = 0.020 + proximity * 0.018;
  lowerLight.intensity = 1.30 + proximity * 0.34;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
