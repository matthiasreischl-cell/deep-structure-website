(() => {
  'use strict';

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

  function onPointerMove(event) {
    previousX = pointerX;
    previousY = pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    const dx = pointerX - previousX;
    const dy = pointerY - previousY;
    speed = Math.min(1, Math.hypot(dx, dy) / 45);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    compass.style.setProperty('--needle-angle', `${angle}deg`);
    document.body.classList.add('pointer-ready');
  }

  function animateCursor() {
    cursorX += (pointerX - cursorX) * 0.23;
    cursorY += (pointerY - cursorY) * 0.23;
    compass.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    requestAnimationFrame(animateCursor);
  }

  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('pointerleave', () => document.body.classList.remove('pointer-ready'));
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
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') enter();
  });

  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance'
  });

  if (!gl) return;

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

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
                 mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
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

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      vec2 p = uv - .5;
      p.x *= uResolution.x / uResolution.y;

      vec2 mouse = uPointer / uResolution.xy - .5;
      mouse.x *= uResolution.x / uResolution.y;

      float t = uTime * .055;
      float base = fbm(p * 2.5 + vec2(t * .35, -t * .2));
      float fine = fbm(p * 5.2 - vec2(t * .2, t * .28));

      float d = length(p - mouse);
      float rings = sin(d * 38.0 - uTime * (2.2 + uSpeed * 4.0));
      rings *= exp(-d * 5.2) * (0.12 + uSpeed * .48);

      vec2 warped = p + vec2(
        sin((p.y + fine * .18) * 13.0 + uTime * .12),
        cos((p.x - base * .2) * 12.0 - uTime * .1)
      ) * .012;

      float water = fbm(warped * 3.8 + base * .7);
      float highlight = smoothstep(.56, .9, water + rings * .7);
      float vignette = 1.0 - smoothstep(.18, .92, length(p));
      float halo = exp(-d * 6.5) * (.05 + uSpeed * .09);

      vec3 black = vec3(.003, .008, .012);
      vec3 deep = vec3(.012, .045, .058);
      vec3 ice = vec3(.23, .67, .78);

      vec3 col = mix(black, deep, water * .64 + base * .16);
      col += ice * highlight * .075;
      col += ice * max(rings, 0.0) * .085;
      col += ice * halo;
      col *= .55 + vignette * .58;

      float grain = (hash(gl_FragCoord.xy + uTime) - .5) * .018;
      col += grain;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uPointer = gl.getUniformLocation(program, 'uPointer');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uSpeed = gl.getUniformLocation(program, 'uSpeed');

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  addEventListener('resize', resize, { passive: true });
  resize();

  const start = performance.now();
  function render(now) {
    const dprX = canvas.width / innerWidth;
    const dprY = canvas.height / innerHeight;
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform2f(uPointer, pointerX * dprX, (innerHeight - pointerY) * dprY);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform1f(uSpeed, speed);
    speed *= .93;
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
