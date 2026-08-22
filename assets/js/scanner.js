/* Scanner — puerto vanilla (sin React, sin ogl) del componente Scanner de
   React Bits, usando WebGL2 directo: el shader es el mismo, sólo se
   reemplaza la capa ogl (Renderer/Program/Mesh/Triangle) por llamadas WebGL2
   equivalentes para no depender de un bundler ni de un paquete npm. */

const VERTEX_SRC = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepFalloff;
uniform float uScale;
uniform float uFrequency;
uniform float uRipple;
uniform float uBandDensity;
uniform float uLineSharpness;
uniform float uGlow;
uniform float uColorSpread;
uniform float uBrightness;
uniform float uContrast;
uniform float uSoftness;
uniform float uVignette;
uniform float uOpacity;
uniform float uScanline;
uniform float uGrain;
uniform float uGrainIntensity;
uniform float uDirection;
uniform vec2 uMouse;
uniform float uMouseEnabled;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseActive;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

const float TAU = 6.2831853;

float signalField(vec2 p, float t) {
  float w = sin(p.x * 1.3 + t * 0.7);
  w += sin(p.y * 1.7 - t * 0.52) * 0.8;
  w += sin((p.x + p.y) * 0.9 + t * 0.91) * 0.6;
  w += sin((p.x - p.y) * 1.53 - t * 0.63) * 0.42;
  return w * 0.35;
}

vec3 palette(float f) {
  f = clamp(f, 0.0, 1.0);
  f = pow(f, uContrast);
  vec3 c = mix(uColor1, uColor2, smoothstep(0.08, 0.6, f));
  return mix(c, uColor3, smoothstep(0.68, 1.0, f));
}

float scanBand(float x, float aa, float sharp) {
  float v = mix(0.5, 0.5 + 0.5 * cos(x * TAU), aa);
  return pow(v, sharp);
}

void main() {
  float aspect = iResolution.x / iResolution.y;
  vec2 uv0 = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
  vec2 p = uv0 / max(uScale, 0.001);

  float t = iTime * uSpeed;

  float mouseBoost = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mUv = vec2((uMouse.x * 2.0 - 1.0) * aspect, uMouse.y * 2.0 - 1.0);
    vec2 md = uv0 - mUv;
    float r = max(uMouseRadius, 0.001);
    mouseBoost = exp(-dot(md, md) / (r * r)) * uMouseStrength * uMouseActive;
  }

  float axis;
  if (uDirection < 0.5) axis = p.y;
  else if (uDirection < 1.5) axis = p.x;
  else axis = (p.x + p.y) * 0.70710678;

  float sig = signalField(p * uFrequency, t);
  float coord = axis + sig * uRipple;

  float phase = coord / max(uSweepWidth, 0.05) - t * uSweepSpeed;
  float sweep = pow(0.5 + 0.5 * cos(phase * TAU), max(uSweepFalloff, 0.1));

  float lc = coord * uBandDensity;
  float aa = 1.0 / (1.0 + uSoftness * fwidth(lc) * 3.0);
  aa = clamp(aa * (1.0 + mouseBoost * 0.6), 0.0, 1.0);

  float bodyBase = clamp(0.5 + 0.5 * sig, 0.0, 1.0);
  float body = bodyBase * bodyBase * uGlow * sweep;

  float sharp = max(uLineSharpness, 0.1);
  float split = uColorSpread * 0.16;
  float fr = clamp(scanBand(lc + split, aa, sharp) * sweep + body, 0.0, 1.0);
  float fg = clamp(scanBand(lc, aa, sharp) * sweep + body, 0.0, 1.0);
  float fb = clamp(scanBand(lc - split, aa, sharp) * sweep + body, 0.0, 1.0);

  vec3 col = vec3(palette(fr).r, palette(fg).g, palette(fb).b);

  float inten = (fr + fg + fb) * 0.3333333 * uBrightness;
  inten *= 1.0 + mouseBoost * 0.9;

  if (uScanline > 0.5) {
    inten *= 1.0 - 0.18 * (0.5 + 0.5 * cos(gl_FragCoord.y * 1.7));
  }

  if (uGrain > 0.5) {
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
    inten += (g - 0.5) * uGrainIntensity;
  }

  inten *= clamp(1.0 - uVignette * smoothstep(0.55, 1.65, length(uv0)), 0.0, 1.0);
  inten = clamp(inten, 0.0, 1.0);

  float a = clamp(inten * uOpacity, 0.0, 1.0);
  fragColor = vec4(clamp(col, 0.0, 1.0) * a, a);
}
`;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

function directionToFloat(dir) {
  return dir === 'horizontal' ? 1.0 : dir === 'diagonal' ? 2.0 : 0.0;
}

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Scanner shader compile error: ' + info);
  }
  return shader;
}

export function mountScanner(container, opts) {
  if (!container) return function () {};

  const config = Object.assign({
    color1: '#0A6874',
    color2: '#10AABE',
    color3: '#FDFDFC',
    speed: 0.35,
    sweepSpeed: 0.18,
    sweepWidth: 1.6,
    sweepFalloff: 6,
    scale: 1.4,
    frequency: 1.6,
    ripple: 0.2,
    bandDensity: 10,
    lineSharpness: 5,
    glow: 0.22,
    scanDirection: 'diagonal',
    colorSpread: 0.45,
    brightness: 1.0,
    contrast: 1.15,
    softness: 1.4,
    vignette: 0.5,
    scanline: true,
    grain: true,
    grainIntensity: 0.035,
    opacity: 1.0,
    mouseInteraction: true,
    mouseRadius: 0.45,
    mouseStrength: 0.35
  }, opts || {});

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) {
    container.removeChild(canvas);
    return function () {};
  }
  gl.clearColor(0, 0, 0, 0);

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Scanner program link error: ' + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['iResolution', 'iTime', 'uSpeed', 'uSweepSpeed', 'uSweepWidth', 'uSweepFalloff', 'uScale', 'uFrequency',
    'uRipple', 'uBandDensity', 'uLineSharpness', 'uGlow', 'uColorSpread', 'uBrightness', 'uContrast', 'uSoftness',
    'uVignette', 'uOpacity', 'uScanline', 'uGrain', 'uGrainIntensity', 'uDirection', 'uMouse', 'uMouseEnabled',
    'uMouseRadius', 'uMouseStrength', 'uMouseActive', 'uColor1', 'uColor2', 'uColor3'
  ].forEach(function (name) { u[name] = gl.getUniformLocation(program, name); });

  const c1 = hexToRgb(config.color1);
  const c2 = hexToRgb(config.color2);
  const c3 = hexToRgb(config.color3);

  gl.uniform1f(u.uSpeed, config.speed);
  gl.uniform1f(u.uSweepSpeed, config.sweepSpeed);
  gl.uniform1f(u.uSweepWidth, config.sweepWidth);
  gl.uniform1f(u.uSweepFalloff, config.sweepFalloff);
  gl.uniform1f(u.uScale, config.scale);
  gl.uniform1f(u.uFrequency, config.frequency);
  gl.uniform1f(u.uRipple, config.ripple);
  gl.uniform1f(u.uBandDensity, config.bandDensity);
  gl.uniform1f(u.uLineSharpness, config.lineSharpness);
  gl.uniform1f(u.uGlow, config.glow);
  gl.uniform1f(u.uColorSpread, config.colorSpread);
  gl.uniform1f(u.uBrightness, config.brightness);
  gl.uniform1f(u.uContrast, config.contrast);
  gl.uniform1f(u.uSoftness, config.softness);
  gl.uniform1f(u.uVignette, config.vignette);
  gl.uniform1f(u.uOpacity, config.opacity);
  gl.uniform1f(u.uScanline, config.scanline ? 1 : 0);
  gl.uniform1f(u.uGrain, config.grain ? 1 : 0);
  gl.uniform1f(u.uGrainIntensity, config.grainIntensity);
  gl.uniform1f(u.uDirection, directionToFloat(config.scanDirection));
  gl.uniform1f(u.uMouseEnabled, config.mouseInteraction ? 1 : 0);
  gl.uniform1f(u.uMouseRadius, config.mouseRadius);
  gl.uniform1f(u.uMouseStrength, config.mouseStrength);
  gl.uniform3f(u.uColor1, c1[0], c1[1], c1[2]);
  gl.uniform3f(u.uColor2, c2[0], c2[1], c2[2]);
  gl.uniform3f(u.uColor3, c3[0], c3[1], c3[2]);

  let width = 1, height = 1;
  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width * dpr));
    height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.iResolution, width, height);
  }
  resize();
  let ro;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else {
    window.addEventListener('resize', resize);
  }

  let targetMouse = [0.5, 0.5];
  let currentMouse = [0.5, 0.5];
  let targetActive = 0;
  let mouseActive = 0;
  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    targetMouse = [(e.clientX - rect.left) / rect.width, 1 - (e.clientY - rect.top) / rect.height];
    targetActive = 1;
  }
  function onPointerLeave() { targetActive = 0; }
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerleave', onPointerLeave);

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const t0 = performance.now();
  let raf = null;

  if (reduceMotion) {
    gl.uniform1f(u.iTime, 0);
    draw();
  } else {
    const loop = function (now) {
      gl.uniform1f(u.iTime, (now - t0) * 0.001);
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      gl.uniform2f(u.uMouse, currentMouse[0], currentMouse[1]);
      mouseActive += 0.05 * (targetActive - mouseActive);
      gl.uniform1f(u.uMouseActive, mouseActive);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  return function destroy() {
    if (raf !== null) cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerleave', onPointerLeave);
    gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext();
    if (canvas.parentElement === container) container.removeChild(canvas);
  };
}
