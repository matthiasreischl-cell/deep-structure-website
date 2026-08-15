(() => {
  'use strict';

  const canvas = document.getElementById('fluid');
  const button = document.getElementById('enterButton');
  const logoFloat = document.getElementById('logoFloat');
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
  let pointerSpeed = 0;
  let entering = false;
  let hoveringLogo = 0;

  let tiltX = 0;
  let tiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let shiftX = 0;
  let shiftY = 0;
  let targetShiftX = 0;
  let targetShiftY = 0;

  function updateLogoTarget(event) {
    const rect = button.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));

    targetTiltX = reducedMotion ? 0 : -ny * 10.5;
    targetTiltY = reducedMotion ? 0 : nx * 13.5;
    targetShiftX = reducedMotion ? 0 : nx * 9;
    targetShiftY = reducedMotion ? 0 : ny * 6;

    button.style.setProperty('--glint-x', `${50 + nx * 29}%`);
    button.style.setProperty('--glint-y', `${38 + ny * 25}%`);
  }

  function resetLogoTarget() {
    hoveringLogo = 0;
    targetTiltX = 0;
    targetTiltY = 0;
    targetShiftX = 0;
    targetShiftY = 0;
  }

  function onPointerMove(event) {
    previousX = pointerX;
    previousY = pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;

    const dx = pointerX - previousX;
    const dy = pointerY - previousY;
    const instantaneous = Math.min(1, Math.hypot(dx, dy) / 32);
    pointerSpeed = Math.max(pointerSpeed, instantaneous);

    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    compass.style.setProperty('--needle-angle', `${angle}deg`);
    document.body.classList.add('pointer-ready');

    if (hoveringLogo) updateLogoTarget(event);
  }

  function animateUI() {
    cursorX += (pointerX - cursorX) * 0.24;
    cursorY += (pointerY - cursorY) * 0.24;
    compass.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

    const ease = hoveringLogo ? 0.105 : 0.075;
    tiltX += (targetTiltX - tiltX) * ease;
    tiltY += (targetTiltY - tiltY) * ease;
    shiftX += (targetShiftX - shiftX) * ease;
    shiftY += (targetShiftY - shiftY) * ease;

    logoFloat.style.setProperty('--tilt-x', `${tiltX.toFixed(3)}deg`);
    logoFloat.style.setProperty('--tilt-y', `${tiltY.toFixed(3)}deg`);
    logoFloat.style.setProperty('--shift-x', `${shiftX.toFixed(3)}px`);
    logoFloat.style.setProperty('--shift-y', `${shiftY.toFixed(3)}px`);

    pointerSpeed *= 0.91;
    requestAnimationFrame(animateUI);
  }

  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerleave', () => document.body.classList.remove('pointer-ready'));

  button.addEventListener('pointerenter', (event) => {
    hoveringLogo = 1;
    updateLogoTarget(event);
  });
  button.addEventListener('pointermove', updateLogoTarget, { passive: true });
  button.addEventListener('pointerleave', resetLogoTarget);

  animateUI();

  function enter() {
    if (entering) return;
    entering = true;
    resetLogoTarget();
    document.body.classList.add('entering');
    transition.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      document.body.classList.remove('entering');
      document.body.classList.add('entered');
      transition.setAttribute('aria-hidden', 'true');
      inside.setAttribute('aria-hidden', 'false');
      location.hash = 'inside';
      window.dispatchEvent(new CustomEvent('deepstructure:entered'));
    }, reducedMotion ? 120 : 3150);
  }

  button.addEventListener('click', enter);

  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    canvas.style.background = 'radial-gradient(circle at 50% 45%, #09202a, #010305 68%)';
    return;
  }

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
    uniform float uTime;
    uniform float uSpeed;
    uniform float uLogoHover;

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
      mat2 r = mat2(.82, -.57, .57, .82);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.03 + 17.1;
        a *= .5;
      }
      return v;
    }

    float heightField(vec2 p, vec2 mouse, float time, float speed) {
      float broad = sin(p.x * 5.7 + time * .72) * .09;
      broad += sin((p.x * .72 + p.y) * 7.9 - time * .57) * .07;
      broad += (fbm(p * 2.25 + vec2(time * .06, -time * .045)) - .5) * .34;

      float d = length(p - mouse);
      float envelope = exp(-d * 2.75);
      float ripple1 = sin(d * 36.0 - time * (3.1 + speed * 2.8));
      float ripple2 = sin(d * 19.0 - time * 2.05 + .7);
      float pointerWave = (ripple1 * .68 + ripple2 * .32) * envelope;
      pointerWave *= .16 + speed * .72 + uLogoHover * .18;

      return broad + pointerWave;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 uv = frag / uResolution.xy;
      vec2 p = uv - .5;
      p.x *= uResolution.x / uResolution.y;

      vec2 mouse = uPointer / uResolution.xy - .5;
      mouse.x *= uResolution.x / uResolution.y;

      float time = uTime;
      float px = 2.1 / uResolution.y;

      float h = heightField(p, mouse, time, uSpeed);
      float hx = heightField(p + vec2(px, 0.0), mouse, time, uSpeed);
      float hy = heightField(p + vec2(0.0, px), mouse, time, uSpeed);

      vec3 normal = normalize(vec3((h - hx) * 8.4, (h - hy) * 8.4, .72));
      vec3 light = normalize(vec3(-.28, .50, .82));
      vec3 viewDir = vec3(0.0, 0.0, 1.0);

      float diffuse = max(dot(normal, light), 0.0);
      float spec = pow(max(dot(reflect(-light, normal), viewDir), 0.0), 36.0);
      float grazing = pow(1.0 - max(normal.z, 0.0), 2.4);

      float d = length(p - mouse);
      float crestWave = .5 + .5 * sin(d * 36.0 - time * (3.1 + uSpeed * 2.8));
      float crest = pow(crestWave, 9.0) * exp(-d * 3.1) * (.18 + uSpeed * .82);

      float movingBand = .5 + .5 * sin((p.x * .54 + p.y) * 24.0 + h * 8.0 - time * .8);
      movingBand = pow(movingBand, 6.0) * .11;

      vec3 deep = vec3(.002, .010, .015);
      vec3 water = vec3(.020, .105, .135);
      vec3 cyan = vec3(.30, .71, .82);

      float depthGlow = smoothstep(.92, .05, length(p * vec2(.78, 1.0))) * .24;
      vec3 color = mix(deep, water, diffuse * .76 + depthGlow + h * .16);
      color += cyan * (spec * .72 + grazing * .18 + crest * .48 + movingBand);

      float logoHalo = exp(-length(p - vec2(0.0, .05)) * 4.0) * uLogoHover;
      color += cyan * logoHalo * .035;

      float vignette = smoothstep(.93, .20, length(p * vec2(.78, .92)));
      color *= .55 + .45 * vignette;

      float grain = hash(frag + floor(time * 12.0)) - .5;
      color += grain * .018;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
  const pointerLocation = gl.getUniformLocation(program, 'uPointer');
  const timeLocation = gl.getUniformLocation(program, 'uTime');
  const speedLocation = gl.getUniformLocation(program, 'uSpeed');
  const logoHoverLocation = gl.getUniformLocation(program, 'uLogoHover');

  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.65);
    width = Math.max(1, Math.floor(innerWidth * dpr));
    height = Math.max(1, Math.floor(innerHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  addEventListener('resize', resize, { passive: true });
  resize();

  const start = performance.now();

  function render(now) {
    resize();
    const elapsed = reducedMotion ? 0 : (now - start) / 1000;

    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform2f(pointerLocation, pointerX * dpr, (innerHeight - pointerY) * dpr);
    gl.uniform1f(timeLocation, elapsed);
    gl.uniform1f(speedLocation, reducedMotion ? 0 : pointerSpeed);
    gl.uniform1f(logoHoverLocation, hoveringLogo);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
