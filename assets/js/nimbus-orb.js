/* RET — Nimbus Orb (esfera de puntos deformada, interactiva). Canvas 2D,
   sin dependencias. Adaptado para montarse por `root` (en vez de un único
   `[data-ret-orb]` global), para poder reutilizarse en varias secciones. */
(function () {
  'use strict';

  function mountNimbusOrb(root, opts) {
    if (!root) return function () {};
    var canvas = root.querySelector('.ret-orb__canvas');
    if (!canvas) return function () {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var config = Object.assign({
      COUNT: 8500,
      SPEED: 1.00,
      SPIN: 0.22,
      AMPLITUDE: 0.185,
      DOT_SIZE: 2.6,
      ORB_SCALE: 0.62,
      CENTER_X: 0.50,
      CENTER_Y: 0.50,
      TILT: -0.18,
      C_BASE: [0.05, 0.78, 0.72],
      C_CREST: [0.25, 0.92, 0.55],
      C_DEEP: [0.45, 0.35, 0.95],
      HOVER_LIFT: 0.16,
      HOVER_GLOW: 2.20,
      HOVER_SHARP: 5.50,
      HOVER_TILT: 0.30,
      HOVER_EASE: 0.075
    }, opts || {});

    var COUNT = config.COUNT, SPEED = config.SPEED, SPIN = config.SPIN,
      AMPLITUDE = config.AMPLITUDE, DOT_SIZE = config.DOT_SIZE, ORB_SCALE = config.ORB_SCALE,
      CENTER_X = config.CENTER_X, CENTER_Y = config.CENTER_Y, TILT = config.TILT,
      C_BASE = config.C_BASE, C_CREST = config.C_CREST, C_DEEP = config.C_DEEP,
      HOVER_LIFT = config.HOVER_LIFT, HOVER_GLOW = config.HOVER_GLOW,
      HOVER_SHARP = config.HOVER_SHARP, HOVER_TILT = config.HOVER_TILT, HOVER_EASE = config.HOVER_EASE;

    var W = 0, H = 0, dpr = 1, N = 0, F = 0, CAM_D = 3.4, cx = 0, cy = 0;
    var PX, PY, PZ;
    var sprites = [], R_STEPS = 12, C_STEPS = 7, rMin = 1, rMax = 2;
    var raf = null, t0 = 0, running = false;

    var hx = 0, hy = 0, hz = 1, tx = 0, ty = 0, tz = 1;
    var pS = 0, pTS = 0, ndX = 0, ndY = 0, tndX = 0, tndY = 0;

    var DIRS = [[0.82, 0.31, -0.48], [-0.44, 0.79, 0.42], [0.19, -0.62, 0.76], [0.66, 0.55, 0.51]];
    var FREQ = [2.7, 3.9, 5.3, 7.1];
    var NSPD = [0.78, -0.60, 0.48, -0.36];
    var WGT = [1.00, 0.62, 0.38, 0.22], WSUM = 2.22;
    (function () {
      for (var i = 0; i < 4; i++) {
        var d = DIRS[i], L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
        d[0] /= L; d[1] /= L; d[2] /= L;
      }
    })();

    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    function buildSprites() {
      sprites = [];
      for (var ci = 0; ci < C_STEPS; ci++) {
        var u = ci / (C_STEPS - 1);
        var col = u < 0.34 ? mix(C_DEEP, C_BASE, u / 0.34)
                           : mix(C_BASE, C_CREST, (u - 0.34) / 0.66);
        var r255 = Math.round(col[0] * 255), g255 = Math.round(col[1] * 255), b255 = Math.round(col[2] * 255);
        var row = [];
        for (var ri = 0; ri < R_STEPS; ri++) {
          var r = rMin + (rMax - rMin) * ri / (R_STEPS - 1);
          var pad = Math.ceil(r * 1.9) + 1;
          var s = document.createElement('canvas');
          s.width = s.height = pad * 2;
          var c = s.getContext('2d');
          var g = c.createRadialGradient(pad, pad, 0, pad, pad, pad);
          g.addColorStop(0.00, 'rgb(' + r255 + ',' + g255 + ',' + b255 + ')');
          g.addColorStop(0.30, 'rgb(' + r255 + ',' + g255 + ',' + b255 + ')');
          g.addColorStop(0.48, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.50)');
          g.addColorStop(0.68, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.11)');
          g.addColorStop(1.00, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0)');
          c.fillStyle = g; c.fillRect(0, 0, pad * 2, pad * 2);
          row.push({ cv: s, half: pad });
        }
        sprites.push(row);
      }
    }

    function build() {
      var rect = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W; canvas.height = H;

      N = rect.width < 760 ? Math.round(COUNT * 0.48) : COUNT;
      cx = W * CENTER_X; cy = H * CENTER_Y;
      F = Math.min(W, H) * ORB_SCALE * CAM_D / 2;

      PX = new Float32Array(N); PY = new Float32Array(N); PZ = new Float32Array(N);
      var GA = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < N; i++) {
        var yy = 1 - 2 * (i + 0.5) / N;
        var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
        var ph = i * GA;
        PX[i] = rr * Math.cos(ph); PY[i] = yy; PZ[i] = rr * Math.sin(ph);
      }

      rMin = DOT_SIZE * (F / (CAM_D + 1.40)) / 241;
      rMax = DOT_SIZE * (F / (CAM_D - 1.40)) / 241;
      buildSprites();
    }

    function draw(time) {
      var t = time * SPEED;

      hx += (tx - hx) * HOVER_EASE; hy += (ty - hy) * HOVER_EASE; hz += (tz - hz) * HOVER_EASE;
      var hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      var nhx = hx / hl, nhy = hy / hl, nhz = hz / hl;
      pS += (pTS - pS) * HOVER_EASE;
      ndX += (tndX - ndX) * HOVER_EASE;
      ndY += (tndY - ndY) * HOVER_EASE;
      var live = pS > 0.004;

      var ay = time * SPIN + ndX * HOVER_TILT;
      var ax = TILT + ndY * HOVER_TILT * 0.7;
      var ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var d0 = DIRS[0], d1 = DIRS[1], d2 = DIRS[2], d3 = DIRS[3];
      var invR = 1 / (rMax - rMin);

      for (var i = 0; i < N; i++) {
        var px = PX[i], py = PY[i], pz = PZ[i];

        var x1 = ca * px + sa * pz;
        var z1 = -sa * px + ca * pz;
        var y2 = cb * py - sb * z1;
        var z2 = sb * py + cb * z1;

        var d = WGT[0] * Math.sin((x1 * d0[0] + y2 * d0[1] + z2 * d0[2]) * FREQ[0] + t * NSPD[0])
              + WGT[1] * Math.sin((x1 * d1[0] + y2 * d1[1] + z2 * d1[2]) * FREQ[1] + t * NSPD[1])
              + WGT[2] * Math.sin((x1 * d2[0] + y2 * d2[1] + z2 * d2[2]) * FREQ[2] + t * NSPD[2])
              + WGT[3] * Math.sin((x1 * d3[0] + y2 * d3[1] + z2 * d3[2]) * FREQ[3] + t * NSPD[3]);
        d = Math.tanh(1.35 * d / WSUM);

        var R = 1 + AMPLITUDE * d;
        var boost = 1;

        if (live) {
          var dt = x1 * nhx + y2 * nhy + z2 * nhz;
          var infl = Math.exp(-(1 - dt) * HOVER_SHARP) * pS;
          if (infl > 0.002) { R += HOVER_LIFT * infl; boost = 1 + HOVER_GLOW * infl; }
        }

        var zc = z2 * R + CAM_D;
        if (zc < 0.35) continue;
        var pp = F / zc;

        var q = 1 - (z2 < 0 ? -z2 : z2);
        var rim = q * q;
        var front = (1 - z2) * 0.5;
        var crest = (d + 1) * 0.5;
        var cr = crest - 0.5;
        var crease = Math.exp(-(cr * cr) * 44.4);

        var a = (0.16 + 0.80 * rim + 0.75 * crease) *
                (0.22 + 0.78 * front) *
                (0.20 + 1.05 * crest * crest) * 1.45 * boost;
        if (a < 0.012) continue;
        if (a > 1) a = 1;

        var r = DOT_SIZE * pp / 241;
        var ri = ((r - rMin) * invR * (R_STEPS - 1)) | 0;
        if (ri < 0) ri = 0; else if (ri >= R_STEPS) ri = R_STEPS - 1;
        var ci = (crest * (C_STEPS - 1)) | 0;
        if (ci < 0) ci = 0; else if (ci >= C_STEPS) ci = C_STEPS - 1;

        var sp = sprites[ci][ri];
        ctx.globalAlpha = a;
        ctx.drawImage(sp.cv, cx + x1 * R * pp - sp.half, cy - y2 * R * pp - sp.half);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      if (!t0) t0 = now;
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    function setPointer(clientX, clientY) {
      var rect = root.getBoundingClientRect();
      var px = (clientX - rect.left) * dpr - cx;
      var py = (clientY - rect.top) * dpr - cy;
      tndX = px / (W * 0.5); tndY = py / (H * 0.5);

      var dx = px / F, dy = -py / F, dz = 1;
      var L = Math.sqrt(dx * dx + dy * dy + 1); dx /= L; dy /= L; dz /= L;

      var b = -2 * CAM_D * dz, cc = CAM_D * CAM_D - 1;
      var disc = b * b - 4 * cc;
      var tHit = disc >= 0 ? (-b - Math.sqrt(disc)) * 0.5 : -b * 0.5;

      var qx = dx * tHit, qy = dy * tHit, qz = -CAM_D + dz * tHit;
      var n = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
      tx = qx / n; ty = qy / n; tz = qz / n;
    }

    build();
    draw(0);
    if (!reduced) start();

    var rt;
    var onResize = function () {
      clearTimeout(rt);
      rt = setTimeout(function () { build(); draw(0); }, 180);
    };
    window.addEventListener('resize', onResize);

    var onEnter, onMove, onLeave;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine && !reduced) {
      onEnter = function (e) {
        setPointer(e.clientX, e.clientY);
        hx = tx; hy = ty; hz = tz; ndX = tndX; ndY = tndY;
        pTS = 1;
      };
      onMove = function (e) { setPointer(e.clientX, e.clientY); pTS = 1; };
      onLeave = function () { pTS = 0; tndX = 0; tndY = 0; };
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

  window.mountNimbusOrb = mountNimbusOrb;
})();
