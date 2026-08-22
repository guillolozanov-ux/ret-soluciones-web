/* RET — Dot Wave background, adaptado para montarse en varias secciones
   del sitio (en vez de un único `[data-ret-wave]` global). Canvas 2D, sin
   dependencias. Lógica igual a la entregada, sólo parametrizada por `root`. */
(function () {
  'use strict';

  function mountDotWave(root, opts) {
    if (!root) return function () {};
    var canvas = root.querySelector('.ret-wave__canvas');
    if (!canvas) return function () {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var config = Object.assign({
      COLOR: [0.07, 0.80, 0.74],
      SPEED: 0.22,
      AMPLITUDE: 1.0,
      DENSITY: 1.0,
      CAM_Y: 30.0,
      DOT_SCALE: 0.34,
      HOVER_LIFT: 1.15,
      HOVER_GLOW: 2.40,
      HOVER_RADIUS: 0.40,
      HOVER_RIPPLE: true,
      HOVER_EASE: 0.10,
      INTENSITY: 1.0
    }, opts || {});

    var COLOR = config.COLOR, SPEED = config.SPEED, AMPLITUDE = config.AMPLITUDE,
      DENSITY = config.DENSITY, CAM_Y = config.CAM_Y, DOT_SCALE = config.DOT_SCALE,
      HOVER_LIFT = config.HOVER_LIFT, HOVER_GLOW = config.HOVER_GLOW,
      HOVER_RADIUS = config.HOVER_RADIUS, HOVER_RIPPLE = config.HOVER_RIPPLE,
      HOVER_EASE = config.HOVER_EASE, INTENSITY = config.INTENSITY;

    var W = 0, H = 0, dpr = 1;
    var COLS = 0, ROWS = 0, N = 0;
    var sx, rad, invZ, u, w, depth, lit, vis;
    var zNear = 0, zSpan = 0, horizon = 0, F = 0;
    var sprites = [], SPRITE_STEPS = 26, maxRad = 1;
    var raf = null, t0 = 0, running = false;

    var pU = 0, pW = 0.5, pTU = 0, pTW = 0.5, pS = 0, pTS = 0;
    var xMaxV = 1;
    var drawOrder = new Int32Array(0);

    function buildSprites() {
      sprites = [];
      var rgb = 'rgb(' + Math.round(COLOR[0] * 255) + ',' +
                         Math.round(COLOR[1] * 255) + ',' +
                         Math.round(COLOR[2] * 255) + ')';
      for (var i = 0; i < SPRITE_STEPS; i++) {
        var r = maxRad * (i + 1) / SPRITE_STEPS;
        var pad = Math.ceil(r * 1.9) + 1;
        var s = document.createElement('canvas');
        s.width = s.height = pad * 2;
        var c = s.getContext('2d');
        var rgba = function (al) {
          return 'rgba(' + Math.round(COLOR[0] * 255) + ',' + Math.round(COLOR[1] * 255) +
                 ',' + Math.round(COLOR[2] * 255) + ',' + al + ')';
        };
        var g = c.createRadialGradient(pad, pad, 0, pad, pad, pad);
        g.addColorStop(0.00, rgb);
        g.addColorStop(0.26, rgb);
        g.addColorStop(0.42, rgba(0.55));
        g.addColorStop(0.62, rgba(0.12));
        g.addColorStop(1.00, rgba(0));
        c.fillStyle = g;
        c.fillRect(0, 0, pad * 2, pad * 2);
        sprites.push({ cv: s, half: pad });
      }
    }

    function build() {
      var rect = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W; canvas.height = H;

      var narrow = rect.width < 760;
      COLS = Math.round((narrow ? 96 : 160) * DENSITY);
      ROWS = Math.round((narrow ? 56 : 84) * DENSITY);
      N = COLS * ROWS;

      F = 0.5625 * W;
      horizon = -1.5 * H;
      var K = CAM_Y * F;
      zNear = K / (2.56 * H);
      var zFar = K / (1.47 * H);
      zSpan = zFar - zNear;
      var xMax = 0.53 * W * zFar / F;
      xMaxV = xMax;
      var step = (2 * xMax) / COLS;

      sx = new Float32Array(N); rad = new Float32Array(N); invZ = new Float32Array(N);
      u = new Float32Array(N); w = new Float32Array(N);
      depth = new Float32Array(N); lit = new Float32Array(N); vis = new Uint8Array(N);

      maxRad = 1;
      var order = [];
      for (var j = 0; j < ROWS; j++) {
        var z = zNear * Math.pow(zFar / zNear, j / (ROWS - 1));
        var iz = 1 / z;
        var wj = (z - zNear) / zSpan;
        var d = Math.pow(Math.max(0, Math.min(1, (zFar - z) / zSpan)), 1.3);
        for (var i = 0; i < COLS; i++) {
          var x = -xMax + step * (i + 0.5);
          var uu = x / xMax;
          var k = j * COLS + i;
          var px = W / 2 + x * F * iz;
          sx[k] = px;
          invZ[k] = iz;
          u[k] = uu; w[k] = wj;
          depth[k] = d;
          var r = DOT_SCALE * step * F * iz;
          rad[k] = r;
          if (r > maxRad) maxRad = r;
          var lu = (uu - 0.430) / 0.591, lw = (wj - 0.125) / 0.288;
          lit[k] = Math.exp(-(lu * lu + lw * lw));
          vis[k] = (px > -40 * dpr && px < W + 40 * dpr) ? 1 : 0;
          if (vis[k]) order.push(k);
        }
      }
      drawOrder = new Int32Array(order.sort(function (a, b) { return b - a; }));
      buildSprites();
    }

    function draw(time) {
      var t = time * SPEED;

      pU += (pTU - pU) * HOVER_EASE;
      pW += (pTW - pW) * HOVER_EASE;
      pS += (pTS - pS) * (HOVER_EASE * 0.8);
      var live = pS > 0.003;
      var hru = HOVER_RADIUS, hrw = HOVER_RADIUS * 0.48;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var last = -1;
      for (var n = 0; n < drawOrder.length; n++) {
        var k = drawOrder[n];
        var uu = u[k], ww = w[k];

        var y = 0.50 * Math.sin(10.2 * uu + 3.1 * ww + t)
              + 0.32 * Math.sin(7.1 * uu - 7.8 * ww + t * 0.73)
              + 0.26 * Math.sin(4.1 * uu + 10.9 * ww + t * 0.41);
        var su = (uu - 0.376) / 0.484, sw = (ww - 0.154) / 0.250;
        y = (y + 0.75 * Math.exp(-(su * su + sw * sw))) * AMPLITUDE;

        var boost = 1;
        if (live) {
          var du = (uu - pU) / hru, dw = (ww - pW) / hrw;
          var q = du * du + dw * dw;
          if (q < 8) {
            var f = Math.exp(-q) * pS;
            var ring = HOVER_RIPPLE
              ? 0.45 + 0.55 * Math.cos(Math.sqrt(q) * 3.4 - t * 4.2)
              : 1;
            y += HOVER_LIFT * f * ring;
            boost = 1 + HOVER_GLOW * f;
          }
        }

        var py = horizon + (CAM_Y - y) * F * invZ[k];
        if (py < -40 || py > H + 40) continue;

        var hn = (y / AMPLITUDE + 1.1) / 2.4;
        hn = hn < 0 ? 0 : hn > 1 ? 1 : hn;
        var a = (0.09 + 0.46 * depth[k]) *
                (0.26 + 0.74 * Math.pow(hn, 1.8)) *
                (0.55 + 1.55 * lit[k]) * boost * INTENSITY;
        if (a < 0.012) continue;
        if (a > 1) a = 1;

        var idx = (Math.round(rad[k] / maxRad * SPRITE_STEPS) | 0) - 1;
        if (idx < 0) idx = 0; else if (idx >= SPRITE_STEPS) idx = SPRITE_STEPS - 1;
        var sp = sprites[idx];

        if (a !== last) { ctx.globalAlpha = a; last = a; }
        ctx.drawImage(sp.cv, sx[k] - sp.half, py - sp.half);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      var g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0.90)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H * 0.55);
    }

    function loop(now) {
      if (!t0) t0 = now;
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    }

    function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    build();
    draw(0);
    if (!reduced) start();

    var rt;
    var onResize = function () {
      clearTimeout(rt);
      rt = setTimeout(function () { build(); draw(0); }, 180);
    };
    window.addEventListener('resize', onResize);

    function setPointer(clientX, clientY) {
      var r = root.getBoundingClientRect();
      var px = (clientX - r.left) * dpr;
      var py = (clientY - r.top) * dpr;
      var z = CAM_Y * F / (py - horizon);
      pTU = ((px - W / 2) * z / F) / xMaxV;
      pTW = (z - zNear) / zSpan;
    }

    var onEnter, onMove, onLeave;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine && !reduced) {
      onEnter = function (e) {
        setPointer(e.clientX, e.clientY);
        pU = pTU; pW = pTW;
        pTS = 1;
      };
      onMove = function (e) { setPointer(e.clientX, e.clientY); pTS = 1; };
      onLeave = function () { pTS = 0; };
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointermove', onMove, { passive: true });
      root.addEventListener('pointerleave', onLeave);
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es[0].isIntersecting ? start() : stop();
      }, { threshold: 0 });
      io.observe(root);
    }
    var onVisibility = function () { document.hidden ? stop() : start(); };
    document.addEventListener('visibilitychange', onVisibility);

    return function destroy() {
      stop();
      window.removeEventListener('resize', onResize);
      if (onEnter) root.removeEventListener('pointerenter', onEnter);
      if (onMove) root.removeEventListener('pointermove', onMove);
      if (onLeave) root.removeEventListener('pointerleave', onLeave);
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  window.mountDotWave = mountDotWave;
})();
