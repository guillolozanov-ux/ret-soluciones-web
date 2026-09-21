(function () {
  if (window.lucide) window.lucide.createIcons();

  // Preloader: logo con barrido teal, visible un mínimo de tiempo para que
  // no sea solo un parpadeo en cargas rápidas/cacheadas.
  var preloader = document.getElementById('site-preloader');
  if (preloader) {
    var MIN_VISIBLE_MS = 700;
    var shownAt = performance.now();
    var hidePreloader = function () {
      preloader.classList.add('is-hidden');
      setTimeout(function () {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 550);
    };
    var scheduleHide = function () {
      var elapsed = performance.now() - shownAt;
      setTimeout(hidePreloader, Math.max(0, MIN_VISIBLE_MS - elapsed));
    };
    if (document.readyState === 'complete') {
      scheduleHide();
    } else {
      window.addEventListener('load', scheduleHide);
    }
  }

  // Mobile nav toggle: manejado por assets/js/staggered-menu.js (mountStaggeredMenu)
  var header = document.getElementById('site-header');

  // Header: transparente sobre el héroe, fondo negro con blur al pasarlo
  if (header) {
    var heroEl = document.querySelector('main .image-panel, main .hero-colorbends');
    var threshold = 40;

    var computeThreshold = function () {
      threshold = heroEl ? Math.max(40, heroEl.offsetHeight * 0.82) : 40;
    };
    computeThreshold();

    var updateHeaderBg = function () {
      header.classList.toggle('scrolled', window.scrollY > threshold);
    };
    updateHeaderBg();

    window.addEventListener('scroll', updateHeaderBg, { passive: true });
    window.addEventListener('resize', function () {
      computeThreshold();
      updateHeaderBg();
    });
  }

  // Portafolio dropdown
  document.querySelectorAll('.nav-dropdown-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dropdown = btn.closest('.nav-dropdown');
      var isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.nav-dropdown.open').forEach(function (dropdown) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        dropdown.querySelector('.nav-dropdown-trigger').setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Tabs (XDR+ screen)
  var tabButtons = document.querySelectorAll('.tabs [data-tab]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');
      tabButtons.forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('active', panel.id === 'tab-' + target);
      });
    });
  });

  // Phase flow selection (click to change active phase)
  document.querySelectorAll('.phase-flow').forEach(function (flow) {
    var phases = flow.querySelectorAll('.phase');
    phases.forEach(function (phase) {
      phase.addEventListener('click', function () {
        phases.forEach(function (p) { p.classList.toggle('active', p === phase); });
      });
    });
  });

  // Contact form: visual-only submit
  var form = document.getElementById('contact-form');
  var acepta = document.getElementById('acepta');
  var submitBtn = document.getElementById('submit-btn');
  var sentAlert = document.getElementById('sent-alert');

  if (acepta && submitBtn) {
    acepta.addEventListener('change', function () {
      submitBtn.disabled = !acepta.checked;
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;
      form.style.display = 'none';
      if (sentAlert) sentAlert.style.display = 'flex';
    });
  }

  // Logo loop: clona el set base las veces que hagan falta para cubrir el
  // ancho de pantalla (con solo 2 copias fijas, en pantallas anchas el set
  // es más angosto que el viewport y se ve el corte antes de repetir).
  // Soporta varias instancias por página (buscadas por clase, no por id).
  document.querySelectorAll('.logo-loop').forEach(function (logoLoop) {
    var logoTrack = logoLoop.querySelector('.logo-loop-track');
    var baseSeq = logoTrack ? logoTrack.querySelector('.logo-loop-seq') : null;
    if (!logoTrack || !baseSeq) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var buildTimer = null;

    var buildLogoLoop = function () {
      Array.prototype.slice.call(logoTrack.querySelectorAll('.logo-loop-seq')).forEach(function (el, i) {
        if (i > 0) el.remove();
      });
      var seqWidth = baseSeq.getBoundingClientRect().width;
      var gapPx = parseFloat(getComputedStyle(logoTrack).columnGap || getComputedStyle(logoTrack).gap) || 0;
      var period = seqWidth + gapPx;
      if (period <= 0) return;
      var containerWidth = logoLoop.clientWidth;
      var copies = Math.max(2, Math.ceil(containerWidth / period) + 2);
      for (var i = 1; i < copies; i++) {
        var clone = baseSeq.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        logoTrack.appendChild(clone);
      }
      logoTrack.style.setProperty('--seq-width', period + 'px');
      // Safari/iOS fija los valores del @keyframes al arrancar la animación (cuando
      // --seq-width aún era 0) y no los recalcula: reiniciarla fuerza a leer el nuevo.
      logoTrack.style.animationName = 'none';
      void logoTrack.offsetWidth;
      logoTrack.style.animationName = '';
      if (!reduceMotion) {
        var speedPxPerSec = 55;
        logoTrack.style.animationDuration = (period / speedPxPerSec) + 's';
      }
    };

    var scheduleBuild = function () {
      clearTimeout(buildTimer);
      buildTimer = setTimeout(buildLogoLoop, 150);
    };

    var imgs = baseSeq.querySelectorAll('img');
    var pending = imgs.length;
    if (pending === 0) {
      buildLogoLoop();
    } else {
      imgs.forEach(function (img) {
        if (img.complete) {
          pending -= 1;
          if (pending === 0) buildLogoLoop();
        } else {
          img.addEventListener('load', function () { pending -= 1; if (pending === 0) buildLogoLoop(); }, { once: true });
          img.addEventListener('error', function () { pending -= 1; if (pending === 0) buildLogoLoop(); }, { once: true });
        }
      });
    }
    window.addEventListener('resize', scheduleBuild);
  });

  // Specular button: halo que recorre el borde y sigue el cursor, en todos
  // los botones principales (btn-primary) de la página.
  if (window.mountSpecularButton) {
    document.querySelectorAll('.btn-primary').forEach(function (btn) {
      window.mountSpecularButton(btn, {
        lineColor: '#FDFDFC',
        baseColor: '#0A6874',
        intensity: 1,
        shineSize: 12,
        shineFade: 35,
        thickness: 1.4,
        speed: 0.3,
        followMouse: true,
        proximity: 260
      });
    });
  }
  // WhatsApp flotante: aparece al pasar el primer hero de la página y, la
  // primera vez en la sesión, abre solo el saludo. Va debajo del banner de
  // cookies y del menú móvil (z-index), así no tapa sus botones.
  (function () {
    var hero = document.querySelector('main > :first-child');
    if (!hero || !('IntersectionObserver' in window)) return;
    var href = 'https://wa.me/573337330444?text=' +
      encodeURIComponent('Hola, quiero información sobre sus servicios.');
    var wa = document.createElement('div');
    wa.className = 'wa';
    wa.innerHTML =
      '<div class="wa-card" id="wa-card" role="dialog" aria-label="Chat de WhatsApp">' +
        '<div class="wa-head">' +
          '<span class="wa-avatar"><img src="assets/logo-ret-blanco.png" alt=""></span>' +
          '<span><span class="wa-title">RET Soluciones</span><span class="wa-sub">Responde en horario laboral</span></span>' +
          '<button type="button" class="wa-close" aria-label="Cerrar chat"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
        '</div>' +
        '<div class="wa-body">' +
          '<p class="wa-bubble">¡Hola! 👋 ¿Tiene preguntas sobre la seguridad o la infraestructura de su empresa? Escríbanos y le respondemos.</p>' +
          '<a class="wa-cta" href="' + href + '" target="_blank" rel="noopener noreferrer">Iniciar chat</a>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="wa-fab" aria-label="Abrir chat de WhatsApp" aria-controls="wa-card" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' +
      '</button>';
    document.body.appendChild(wa);

    var fab = wa.querySelector('.wa-fab');
    var setOpen = function (open) {
      wa.classList.toggle('is-open', open);
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    fab.addEventListener('click', function () { setOpen(!wa.classList.contains('is-open')); });
    wa.querySelector('.wa-close').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

    new IntersectionObserver(function (entries) {
      var past = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
      wa.classList.toggle('is-shown', past);
      if (!past) { setOpen(false); return; }
      var seen = false;
      try { seen = sessionStorage.getItem('wa-greeted') === '1'; sessionStorage.setItem('wa-greeted', '1'); } catch (e) {}
      if (!seen) setTimeout(function () { setOpen(true); }, 600);
    }).observe(hero);
  })();
})();
