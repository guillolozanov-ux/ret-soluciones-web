/* RET — Parallax de scroll simple para elementos dentro de un hero (GSAP
   ScrollTrigger, ya cargado en el sitio). Desplaza el elemento en Y a medida
   que su contenedor cruza el viewport, sin afectar su position/top/right. */
(function () {
  'use strict';

  function mountScrollParallax(el, opts) {
    if (!el || !window.gsap || !window.ScrollTrigger) return function () {};
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return function () {};

    var config = Object.assign({ amount: 60, trigger: el }, opts || {});

    gsap.fromTo(el,
      { y: -config.amount },
      {
        y: config.amount,
        ease: 'none',
        scrollTrigger: {
          trigger: config.trigger,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      }
    );

    return function destroy() {
      var st = ScrollTrigger.getAll().find(function (t) { return t.trigger === config.trigger; });
      if (st) st.kill();
    };
  }

  window.mountScrollParallax = mountScrollParallax;
})();
