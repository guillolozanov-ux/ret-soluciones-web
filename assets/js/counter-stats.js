/* RET — animación de conteo para .stat-value (ej. "+200", "+15.000").
   Sin dependencias nuevas: usa GSAP (ya cargado) para tweenar un número y
   reescribe el texto conservando el prefijo ("+") y el separador de miles
   ("."). Valores que no son un número puro con prefijo (p. ej. "24/7") se
   dejan intactos. */
(function () {
  'use strict';

  function parseStat(text) {
    var m = /^([+]?)(\d[\d.]*)$/.exec(text.trim());
    if (!m) return null;
    var raw = m[2].replace(/\./g, '');
    var target = parseInt(raw, 10);
    if (isNaN(target)) return null;
    return { prefix: m[1], target: target };
  }

  function formatCount(n, prefix) {
    var s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return prefix + s;
  }

  function mountCounterStats(root, opts) {
    if (!root) return function () {};
    var config = Object.assign({ duration: 1.5, ease: 'power2.out', stagger: 0.08 }, opts || {});
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var items = [];
    Array.prototype.slice.call(root.querySelectorAll('.stat-value')).forEach(function (el) {
      var parsed = parseStat(el.textContent);
      if (parsed) items.push({ el: el, parsed: parsed, original: el.textContent });
    });
    if (!items.length || reduced || !window.gsap) return function () {};

    var played = false;
    function play() {
      if (played) return;
      played = true;
      items.forEach(function (it, i) {
        it.el.textContent = formatCount(0, it.parsed.prefix);
        var obj = { v: 0 };
        gsap.to(obj, {
          v: it.parsed.target,
          duration: config.duration,
          delay: i * config.stagger,
          ease: config.ease,
          onUpdate: function () { it.el.textContent = formatCount(obj.v, it.parsed.prefix); },
          onComplete: function () { it.el.textContent = it.original; }
        });
      });
    }

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { play(); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(root);
    } else {
      play();
    }

    return function destroy() { if (io) io.disconnect(); };
  }

  window.mountCounterStats = mountCounterStats;
})();
