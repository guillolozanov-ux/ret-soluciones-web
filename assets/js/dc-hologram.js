/* RET — Datacenter Hologram (racks de puntos, piso e interacción).
   Canvas 2D, sin dependencias. Adaptado para montarse por `root` (como
   dot-wave.js / nimbus-orb.js), para poder reutilizarse en varias secciones. */
(function () {
  'use strict';

  function mountDcHologram(root, opts) {
    if (!root) return function () {};
    var canvas = root.querySelector('.ret-dc__canvas');
    if (!canvas) return function () {};
    var ctx = canvas.getContext('2d', { alpha: false });
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var config = Object.assign({
      COLOR: [0.35, 1.00, 0.94],
      SPEED: 1.00,
      FOV: 1180,
      CAM_D: 5.3,
      CAM_H: 1.62,
      SCENE_Y: 0.52,
      FLOOR_GAIN: 1.85,
      RACK_GAIN: 1.85,
      GLOW: 0.26,
      DOT: 1.5,
      HOVER_YAW: 0.13,
      HOVER_PITCH: 0.10,
      HOVER_RIPPLE: 0.34,
      HOVER_RACK: 1.30,
      HOVER_EASE: 0.075,
      RACKS: [
        [0.00, 0.00, 0, 1.60, 3.60, 1.00],
        [-1.62, 1.00, 22, 1.45, 3.20, 0.88],
        [1.62, 1.00, -22, 1.45, 3.20, 0.88],
        [-3.10, 2.55, 40, 1.35, 2.80, 0.74],
        [3.10, 2.55, -40, 1.35, 2.80, 0.74]
      ]
    }, opts || {});

    var COLOR = config.COLOR, SPEED = config.SPEED, FOV = config.FOV, CAM_D = config.CAM_D,
      CAM_H = config.CAM_H, SCENE_Y = config.SCENE_Y, FLOOR_GAIN = config.FLOOR_GAIN,
      RACK_GAIN = config.RACK_GAIN, GLOW = config.GLOW, DOT = config.DOT,
      HOVER_YAW = config.HOVER_YAW, HOVER_PITCH = config.HOVER_PITCH, HOVER_RIPPLE = config.HOVER_RIPPLE,
      HOVER_RACK = config.HOVER_RACK, HOVER_EASE = config.HOVER_EASE, RACKS = config.RACKS;

    var W = 0, H = 0, dpr = 1, F = 0, CX = 0, CY = 0, mobile = false;
    var raf = null, t0 = 0, running = false;

    var rk = [], edge = null, beam = null, flx, flz, FCOLS, FROWS;
    var sprites = [], halos = [], R_STEPS = 14, rMin = 0.5, rMax = 6;

    var pS = 0, pTS = 0, ndX = 0, ndY = 0, tndX = 0, tndY = 0;
    var wx = 0, wz = 0, twx = 0, twz = 0, hotRack = -1, rackGlow = [];

    var _s = 1337;
    function rnd() { _s = (_s * 1664525 + 1013904223) | 0; return ((_s >>> 8) & 0xffffff) / 0x1000000; }

    function buildSprites() {
      sprites = []; halos = [];
      var r255 = Math.round(COLOR[0] * 255), g255 = Math.round(COLOR[1] * 255), b255 = Math.round(COLOR[2] * 255);
      for (var i = 0; i < R_STEPS; i++) {
        var r = rMin + (rMax - rMin) * i / (R_STEPS - 1);
        var pad = Math.ceil(r * 2.0) + 1;
        var s = document.createElement('canvas');
        s.width = s.height = pad * 2;
        var c = s.getContext('2d');
        var g = c.createRadialGradient(pad, pad, 0, pad, pad, pad);
        g.addColorStop(0.00, 'rgb(' + r255 + ',' + g255 + ',' + b255 + ')');
        g.addColorStop(0.28, 'rgb(' + r255 + ',' + g255 + ',' + b255 + ')');
        g.addColorStop(0.46, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.52)');
        g.addColorStop(0.66, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.13)');
        g.addColorStop(1.00, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0)');
        c.fillStyle = g; c.fillRect(0, 0, pad * 2, pad * 2);
        sprites.push({ cv: s, half: pad });

        var hp = Math.ceil(r * 6) + 2;
        var hs = document.createElement('canvas');
        hs.width = hs.height = hp * 2;
        var hc = hs.getContext('2d');
        var hg = hc.createRadialGradient(hp, hp, 0, hp, hp, hp);
        hg.addColorStop(0.00, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.60)');
        hg.addColorStop(0.22, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.26)');
        hg.addColorStop(0.52, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0.06)');
        hg.addColorStop(1.00, 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',0)');
        hc.fillStyle = hg; hc.fillRect(0, 0, hp * 2, hp * 2);
        halos.push({ cv: hs, half: hp });
      }
    }

    function build() {
      var rect = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W; canvas.height = H;
      mobile = rect.width < 760;

      F = FOV * (W / 1400);
      CX = W * 0.5; CY = H * SCENE_Y;
      rMin = 0.5 * dpr; rMax = 7 * dpr;
      buildSprites();

      _s = 1337;
      rk = []; rackGlow = [];

      var NU = mobile ? 16 : 22, NV = mobile ? 34 : 48;
      var ex = [], ey = [], ez = [], ea = [];
      var i, j, k;

      for (var r = 0; r < RACKS.length; r++) {
        var R = RACKS[r], rx = R[0], rz = R[1], th = R[2] * Math.PI / 180;
        var rw = R[3], rh = R[4], gain = R[5];
        var ct = Math.cos(th), st = Math.sin(th);
        rackGlow.push(0);

        var n = NU * NV;
        var X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
        var A = new Float32Array(n), PH = new Float32Array(n), AC = new Uint8Array(n);

        var band = new Float32Array(NV);
        var c0 = new Int16Array(NV), c1 = new Int16Array(NV);
        for (j = 0; j < NV; j++) { band[j] = 0.15; c0[j] = 0; c1[j] = -1; }
        for (var u0 = 0; u0 < NV; u0 += 5) {
          if (rnd() < 0.12) continue;
          var a0 = 1 + ((rnd() * (NU / 2 - 1)) | 0);
          var a1 = ((NU / 2) | 0) + ((rnd() * (NU / 2 - 1)) | 0);
          var lvl = 0.95 + 0.60 * rnd();
          for (k = 0; k < 4 && u0 + k < NV; k++) { band[u0 + k] = lvl; c0[u0 + k] = a0; c1[u0 + k] = a1; }
        }

        for (j = 0; j < NV; j++) {
          var v = 0.10 + (rh - 0.10) * j / (NV - 1);
          for (i = 0; i < NU; i++) {
            var u = -rw / 2 + rw * i / (NU - 1);
            var idx = j * NU + i;
            X[idx] = rx + u * ct; Y[idx] = v; Z[idx] = rz - u * st;
            A[idx] = (i >= c0[j] && i <= c1[j]) ? band[j] : 0.15;
            PH[idx] = rnd() * 6.283;
            AC[idx] = rnd() < 0.05 ? 1 : 0;
          }
        }
        rk.push({ X: X, Y: Y, Z: Z, A: A, PH: PH, AC: AC, n: n, gain: gain, cx: rx, cy: rh * 0.5, cz: rz });

        var d = 0.62;
        var C = [];
        var corner = function (su, sv, sd) {
          return [rx + su * (rw / 2) * ct + sd * d * st, sv * rh, rz - su * (rw / 2) * st + sd * d * ct];
        };
        C.push(corner(-1, 0, 0), corner(1, 0, 0), corner(1, 1, 0), corner(-1, 1, 0),
          corner(-1, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(-1, 1, 1));
        var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (k = 0; k < E.length; k++) {
          var a = C[E[k][0]], b = C[E[k][1]];
          var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
          var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          var steps = Math.max(12, Math.round(len * (mobile ? 34 : 52)));
          for (i = 0; i <= steps; i++) {
            var tt = i / steps;
            ex.push(a[0] + dx * tt); ey.push(a[1] + dy * tt); ez.push(a[2] + dz * tt);
            ea.push(0.95 * gain);
          }
        }
      }
      edge = { X: Float32Array.from(ex), Y: Float32Array.from(ey), Z: Float32Array.from(ez), A: Float32Array.from(ea), n: ex.length };

      var bn = mobile ? 22 : 42, bx = [], bz = [], bh = [], bp = [];
      for (i = 0; i < bn; i++) {
        var rr = RACKS[(i * 7) % RACKS.length];
        bx.push(rr[0] + (rnd() - 0.5) * rr[3] * 1.9);
        bz.push(rr[1] + 0.25 + rnd() * 1.4);
        bh.push(0.6 + rnd() * 1.1);
        bp.push(rnd() * 6.283);
      }
      beam = { X: Float32Array.from(bx), Z: Float32Array.from(bz), Hh: Float32Array.from(bh), PH: Float32Array.from(bp), n: bn };

      FCOLS = mobile ? 90 : 132; FROWS = mobile ? 40 : 62;
      flx = new Float32Array(FCOLS); flz = new Float32Array(FROWS);
      for (i = 0; i < FCOLS; i++) flx[i] = -11 + 22 * i / (FCOLS - 1);
      for (j = 0; j < FROWS; j++) flz[j] = -2.5 + 18.5 * j / (FROWS - 1);
    }

    var yawC = 1, yawS = 0, camH = CAM_H, invRS = 1;

    function put(x, y, z, a, glow) {
      var zz = z - 1.2;
      var xr = yawC * x + yawS * zz;
      var zr = -yawS * x + yawC * zz + 1.2;
      var zc = zr + CAM_D;
      if (zc < 0.3) return;
      var pp = F / zc;
      var sx = CX + xr * pp;
      if (sx < -30 || sx > W + 30) return;
      var sy = CY - (y - camH) * pp;
      if (sy < -30 || sy > H + 30) return;
      var r = DOT * dpr * pp / 300;
      var ri = ((r - rMin) * invRS * (R_STEPS - 1)) | 0;
      if (ri < 0) ri = 0; else if (ri >= R_STEPS) ri = R_STEPS - 1;

      if (glow && GLOW > 0 && a > 0.5) {
        var hl = halos[ri];
        ctx.globalAlpha = (a > 1 ? 1 : a) * GLOW;
        ctx.drawImage(hl.cv, sx - hl.half, sy - hl.half);
      }

      var sp = sprites[ri];
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.drawImage(sp.cv, sx - sp.half, sy - sp.half);
    }

    function draw(time) {
      var t = time * SPEED;

      pS += (pTS - pS) * HOVER_EASE;
      ndX += (tndX - ndX) * HOVER_EASE;
      ndY += (tndY - ndY) * HOVER_EASE;
      wx += (twx - wx) * HOVER_EASE;
      wz += (twz - wz) * HOVER_EASE;

      var yaw = ndX * HOVER_YAW;
      yawC = Math.cos(yaw); yawS = Math.sin(yaw);
      camH = CAM_H + ndY * HOVER_PITCH;
      invRS = 1 / (rMax - rMin);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var i, j, k;

      var rip = HOVER_RIPPLE * pS;
      for (j = 0; j < FROWS; j++) {
        var z = flz[j];
        for (i = 0; i < FCOLS; i++) {
          var x = flx[i];
          var y = 0.10 * Math.sin(0.55 * x + 0.30 * z + t) + 0.07 * Math.sin(0.40 * x - 0.70 * z + t * 0.8);
          var glow = 0;
          if (pS > 0.004) {
            var ddx = (x - wx) * 0.42, ddz = (z - wz) * 0.42;
            var q = ddx * ddx + ddz * ddz;
            if (q < 7) {
              var f = Math.exp(-q);
              y += rip * f * (0.45 + 0.55 * Math.cos(Math.sqrt(q) * 3.2 - t * 4.0));
              glow = 1.5 * f * pS;
            }
          }
          var dz2 = z - 1.5;
          var near = Math.exp(-(x * x + dz2 * dz2) / 25);
          var crest = (y / 0.17 + 1) * 0.5;
          if (crest < 0) crest = 0; else if (crest > 1) crest = 1;
          var a = (0.04 + FLOOR_GAIN * near) * (0.22 + 0.78 * crest * crest) + glow;
          if (a > 0.01) put(x, y, z, a);
        }
      }

      for (k = 0; k < rk.length; k++) {
        var R = rk[k];
        rackGlow[k] += (((hotRack === k ? 1 : 0) * pS) - rackGlow[k]) * HOVER_EASE;
        var g = R.gain * RACK_GAIN * (1 + HOVER_RACK * rackGlow[k]);
        var A = R.A, PH = R.PH, AC = R.AC, X = R.X, Y = R.Y, Z = R.Z;
        for (i = 0; i < R.n; i++) {
          var a2 = A[i];
          if (AC[i]) a2 *= 0.45 + 0.85 * (0.5 + 0.5 * Math.sin(t * 3.1 + PH[i]));
          put(X[i], Y[i], Z[i], a2 * g, true);
        }
      }

      for (i = 0; i < edge.n; i++) put(edge.X[i], edge.Y[i], edge.Z[i], edge.A[i], true);

      for (k = 0; k < beam.n; k++) {
        var bxk = beam.X[k], bzk = beam.Z[k], bhk = beam.Hh[k];
        var pulse = ((t * 0.45 + beam.PH[k] / 6.283) % 1);
        for (i = 0; i < 16; i++) {
          var f2 = i / 15;
          var av = 0.75 * (1 - f2) * (0.35 + 0.65 * Math.exp(-Math.pow((f2 - pulse) * 4, 2)));
          if (av > 0.02) put(bxk, f2 * bhk, bzk, av, true);
        }
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
      var px = (clientX - rect.left) * dpr;
      var py = (clientY - rect.top) * dpr;
      tndX = (px - CX) / (W * 0.5);
      tndY = (py - CY) / (H * 0.5);

      var dx = (px - CX) / F, dy = -(py - CY) / F;
      if (dy < -0.02) {
        var tt = -CAM_H / dy;
        if (tt > 0 && tt < 40) { twx = dx * tt; twz = tt - CAM_D; }
      }

      var best = -1, bd = 1e9;
      for (var k = 0; k < rk.length; k++) {
        var R = rk[k];
        var zc = R.cz + CAM_D;
        var pp = F / zc;
        var sx = CX + R.cx * pp, sy = CY - (R.cy - CAM_H) * pp;
        var d = (sx - px) * (sx - px) * 1.0 + (sy - py) * (sy - py) * 0.25;
        if (d < bd) { bd = d; best = k; }
      }
      hotRack = bd < (W * 0.22) * (W * 0.22) ? best : -1;
    }

    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine && !reduced) {
      root.addEventListener('pointerenter', function (e) {
        setPointer(e.clientX, e.clientY);
        ndX = tndX; ndY = tndY; wx = twx; wz = twz; pTS = 1;
      });
      root.addEventListener('pointermove', function (e) {
        setPointer(e.clientX, e.clientY); pTS = 1;
      }, { passive: true });
      root.addEventListener('pointerleave', function () {
        pTS = 0; tndX = 0; tndY = 0; hotRack = -1;
      });
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
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) io.disconnect();
    };
  }

  window.mountDcHologram = mountDcHologram;
})();
