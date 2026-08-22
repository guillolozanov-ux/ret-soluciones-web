/* SpecularButton — puerto vanilla (sin React, sin ogl) del componente de
   React Bits: un halo especular que recorre el borde redondeado del botón
   y se orienta hacia el cursor. Usa WebGL2 directo (misma fórmula SDF del
   componente original) en vez de la librería ogl, para no añadir una
   dependencia nueva al sitio estático. */
(function () {
  var PAD = 20;

  var VERT = '#version 300 es\n' +
    'in vec2 position;\n' +
    'void main() { gl_Position = vec4(position, 0.0, 1.0); }\n';

  var FRAG = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2 uCenter; uniform vec2 uHalfSize; uniform float uRadius; uniform float uAngle;\n' +
    'uniform float uPx; uniform vec3 uLineColor; uniform vec3 uBaseColor; uniform float uIntensity;\n' +
    'uniform float uShineSize; uniform float uShineFade; uniform float uThickness; uniform float uBaseWidth;\n' +
    'out vec4 fragColor;\n' +
    'float sdRoundedRect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }\n' +
    'float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }\n' +
    'float gaussianLine(float d, float sigma) { float x = d / (sigma + 1e-6); float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x)); return exp(-k * x * x); }\n' +
    'void main() {\n' +
    '  vec2 p = gl_FragCoord.xy - uCenter;\n' +
    '  float d = shapeSDF(p);\n' +
    '  vec2 L = vec2(cos(uAngle), sin(uAngle));\n' +
    '  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;\n' +
    '  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);\n' +
    '  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));\n' +
    '  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);\n' +
    '  float line = gaussianLine(d, uThickness);\n' +
    '  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));\n' +
    '  float hi = line * rim * edgeClamp * uIntensity;\n' +
    '  vec3 col = uBaseColor * base + uLineColor * hi;\n' +
    '  float a = clamp(base + hi, 0.0, 1.0);\n' +
    '  fragColor = vec4(col, a);\n' +
    '}\n';

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  function compileShader(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('SpecularButton shader error: ' + info);
    }
    return shader;
  }

  function mountSpecularButton(buttonEl, opts) {
    if (!buttonEl || buttonEl.dataset.specularInit) return function () {};
    buttonEl.dataset.specularInit = '1';

    var config = Object.assign({
      lineColor: '#FDFDFC',
      baseColor: '#0A6874',
      intensity: 1,
      shineSize: 12,
      shineFade: 35,
      thickness: 1.4,
      speed: 0.3,
      followMouse: true,
      proximity: 260,
      autoAnimate: false,
      radius: 999
    }, opts || {});

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return function () {};

    if (getComputedStyle(buttonEl).position === 'static') buttonEl.style.position = 'relative';

    var labelWrap = document.createElement('span');
    labelWrap.className = 'specular-label-wrap';
    while (buttonEl.firstChild) labelWrap.appendChild(buttonEl.firstChild);

    var fx = document.createElement('span');
    fx.className = 'specular-fx';
    fx.setAttribute('aria-hidden', 'true');

    buttonEl.appendChild(fx);
    buttonEl.appendChild(labelWrap);

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    fx.appendChild(canvas);

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return function () {};
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('SpecularButton link error: ' + gl.getProgramInfoLog(program));
    gl.useProgram(program);

    var posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['uCenter', 'uHalfSize', 'uRadius', 'uAngle', 'uPx', 'uLineColor', 'uBaseColor', 'uIntensity', 'uShineSize', 'uShineFade', 'uThickness', 'uBaseWidth']
      .forEach(function (name) { u[name] = gl.getUniformLocation(program, name); });

    var size = { w: 1, h: 1 };
    function resize() {
      var rect = buttonEl.getBoundingClientRect();
      size.w = rect.width; size.h = rect.height;
      var cw = Math.max(1, Math.round((size.w + PAD * 2) * dpr));
      var ch = Math.max(1, Math.round((size.h + PAD * 2) * dpr));
      canvas.width = cw; canvas.height = ch;
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(u.uCenter, (PAD + size.w / 2) * dpr, (PAD + size.h / 2) * dpr);
      gl.uniform2f(u.uHalfSize, (size.w / 2) * dpr, (size.h / 2) * dpr);
    }
    resize();
    var ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(resize); ro.observe(buttonEl); }
    else window.addEventListener('resize', resize);

    var pointerAngle = null;
    var proximityT = 0;
    function onPointerMove(e) {
      var rect = buttonEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      var dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      var dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      var dist = Math.hypot(dx, dy);
      if (dist === 0) {
        var nx = (e.clientX - cx) / (rect.width / 2);
        var ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      var t = Math.max(0, 1 - dist / Math.max(config.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    }
    window.addEventListener('pointermove', onPointerMove);

    var angle = 2.4, idleAngle = 2.4, bright = 0, last = performance.now(), raf = 0;
    var lineC = hexToRgb(config.lineColor), baseC = hexToRgb(config.baseColor);
    gl.uniform1f(u.uPx, dpr);
    gl.uniform1f(u.uBaseWidth, dpr);

    function loop(now) {
      raf = requestAnimationFrame(loop);
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      idleAngle += config.speed * dt;
      var steer = config.followMouse && pointerAngle != null && (!config.autoAnimate || proximityT > 0);
      var target = steer ? pointerAngle : idleAngle;
      var diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      var brightTarget = config.autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      gl.uniform1f(u.uAngle, angle);
      gl.uniform1f(u.uRadius, Math.min(config.radius, Math.min(size.w, size.h) / 2) * dpr);
      gl.uniform3f(u.uLineColor, lineC[0], lineC[1], lineC[2]);
      gl.uniform3f(u.uBaseColor, baseC[0], baseC[1], baseC[2]);
      gl.uniform1f(u.uIntensity, config.intensity * bright);
      gl.uniform1f(u.uShineSize, (config.shineSize * Math.PI) / 180);
      gl.uniform1f(u.uShineFade, (config.shineFade * Math.PI) / 180);
      gl.uniform1f(u.uThickness, config.thickness * dpr);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(loop);

    return function destroy() {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }

  window.mountSpecularButton = mountSpecularButton;
})();
