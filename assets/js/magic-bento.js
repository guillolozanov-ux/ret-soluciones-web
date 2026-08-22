/* Magic Bento — puerto vanilla (sin React) del componente MagicBento de
   React Bits: spotlight que sigue el cursor, glow de borde por tarjeta,
   partículas al hover, magnetismo sutil y ripple al clic. Se aplica sobre
   las tarjetas ya existentes de una sección (no cambia su layout/tamaño),
   sólo agrega el comportamiento interactivo. Usa GSAP global (ya cargado
   por fold-text.js / gsap CDN), sin dependencias nuevas. */
(function () {
  if (typeof window === 'undefined' || !window.gsap) return;
  var gsap = window.gsap;

  function createParticle(x, y, color) {
    var el = document.createElement('div');
    el.className = 'bento-particle';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.background = 'rgba(' + color + ',1)';
    el.style.boxShadow = '0 0 6px rgba(' + color + ',.6)';
    return el;
  }

  function calcSpotlightValues(radius) {
    return { proximity: radius * 0.5, fadeDistance: radius * 0.75 };
  }

  function updateCardGlow(card, mouseX, mouseY, glow, radius) {
    var rect = card.getBoundingClientRect();
    var relX = ((mouseX - rect.left) / rect.width) * 100;
    var relY = ((mouseY - rect.top) / rect.height) * 100;
    card.style.setProperty('--glow-x', relX + '%');
    card.style.setProperty('--glow-y', relY + '%');
    card.style.setProperty('--glow-intensity', String(glow));
    card.style.setProperty('--glow-radius', radius + 'px');
  }

  function initCardInteractions(card, opts) {
    var particles = [];
    var timeouts = [];
    var isHovered = false;
    var magnetTween = null;
    var particlesInit = false;
    var memoParticles = [];

    function initParticles() {
      if (particlesInit) return;
      var rect = card.getBoundingClientRect();
      memoParticles = [];
      for (var i = 0; i < opts.particleCount; i++) {
        memoParticles.push(createParticle(Math.random() * rect.width, Math.random() * rect.height, opts.glowColor));
      }
      particlesInit = true;
    }

    function clearParticles() {
      timeouts.forEach(clearTimeout);
      timeouts = [];
      if (magnetTween) magnetTween.kill();
      particles.forEach(function (p) {
        gsap.to(p, {
          scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)',
          onComplete: function () { if (p.parentNode) p.parentNode.removeChild(p); }
        });
      });
      particles = [];
    }

    function animateParticles() {
      if (!isHovered) return;
      if (!particlesInit) initParticles();
      memoParticles.forEach(function (particle, index) {
        var id = setTimeout(function () {
          if (!isHovered) return;
          var clone = particle.cloneNode(true);
          card.appendChild(clone);
          particles.push(clone);
          gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });
          gsap.to(clone, {
            x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80,
            rotation: Math.random() * 360, duration: 2 + Math.random() * 2, ease: 'none', repeat: -1, yoyo: true
          });
          gsap.to(clone, { opacity: 0.3, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true });
        }, index * 100);
        timeouts.push(id);
      });
    }

    card.addEventListener('mouseenter', function () {
      isHovered = true;
      if (opts.enableStars) animateParticles();
    });

    card.addEventListener('mouseleave', function () {
      isHovered = false;
      if (opts.enableStars) clearParticles();
      if (opts.enableMagnetism) gsap.to(card, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
    });

    card.addEventListener('mousemove', function (e) {
      if (!opts.enableMagnetism) return;
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left, y = e.clientY - rect.top;
      var cx = rect.width / 2, cy = rect.height / 2;
      magnetTween = gsap.to(card, { x: (x - cx) * 0.04, y: (y - cy) * 0.04, duration: 0.3, ease: 'power2.out' });
    });

    if (opts.clickEffect) {
      card.addEventListener('click', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var maxDistance = Math.max(
          Math.hypot(x, y), Math.hypot(x - rect.width, y),
          Math.hypot(x, y - rect.height), Math.hypot(x - rect.width, y - rect.height)
        );
        var ripple = document.createElement('div');
        ripple.className = 'bento-ripple';
        ripple.style.width = (maxDistance * 2) + 'px';
        ripple.style.height = (maxDistance * 2) + 'px';
        ripple.style.left = (x - maxDistance) + 'px';
        ripple.style.top = (y - maxDistance) + 'px';
        ripple.style.background = 'radial-gradient(circle, rgba(' + opts.glowColor + ',.4) 0%, rgba(' + opts.glowColor + ',.2) 30%, transparent 70%)';
        card.appendChild(ripple);
        gsap.fromTo(ripple, { scale: 0, opacity: 1 }, {
          scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out',
          onComplete: function () { ripple.remove(); }
        });
      });
    }
  }

  function initSpotlight(section, cards, opts) {
    var spotlight = document.createElement('div');
    spotlight.className = 'global-spotlight';
    spotlight.style.width = '800px';
    spotlight.style.height = '800px';
    spotlight.style.background = 'radial-gradient(circle,' +
      'rgba(' + opts.glowColor + ',.15) 0%,' +
      'rgba(' + opts.glowColor + ',.08) 15%,' +
      'rgba(' + opts.glowColor + ',.04) 25%,' +
      'rgba(' + opts.glowColor + ',.02) 40%,' +
      'rgba(' + opts.glowColor + ',.01) 65%,' +
      'transparent 70%)';
    document.body.appendChild(spotlight);

    var vals = calcSpotlightValues(opts.spotlightRadius);

    function onMove(e) {
      var rect = section.getBoundingClientRect();
      var inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!inside) {
        gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: 'power2.out' });
        cards.forEach(function (c) { c.style.setProperty('--glow-intensity', '0'); });
        return;
      }

      var minDistance = Infinity;
      cards.forEach(function (card) {
        var cardRect = card.getBoundingClientRect();
        var cx = cardRect.left + cardRect.width / 2, cy = cardRect.top + cardRect.height / 2;
        var distance = Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(cardRect.width, cardRect.height) / 2;
        var effective = Math.max(0, distance);
        minDistance = Math.min(minDistance, effective);

        var glow = 0;
        if (effective <= vals.proximity) glow = 1;
        else if (effective <= vals.fadeDistance) glow = (vals.fadeDistance - effective) / (vals.fadeDistance - vals.proximity);

        updateCardGlow(card, e.clientX, e.clientY, glow, opts.spotlightRadius);
      });

      gsap.to(spotlight, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' });

      var targetOpacity = minDistance <= vals.proximity ? 0.8
        : minDistance <= vals.fadeDistance ? ((vals.fadeDistance - minDistance) / (vals.fadeDistance - vals.proximity)) * 0.8
        : 0;
      gsap.to(spotlight, { opacity: targetOpacity, duration: targetOpacity > 0 ? 0.2 : 0.5, ease: 'power2.out' });
    }

    document.addEventListener('mousemove', onMove);
  }

  window.initMagicBento = function (sectionEl, cardEls, opts) {
    if (!sectionEl || !cardEls || !cardEls.length) return;
    var isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isMobile || reduceMotion) return;

    var config = Object.assign({
      glowColor: '16, 170, 190',
      spotlightRadius: 300,
      particleCount: 8,
      enableStars: true,
      enableMagnetism: true,
      clickEffect: true
    }, opts || {});

    cardEls.forEach(function (card) {
      card.classList.add('magic-bento-card');
      card.style.setProperty('--glow-color', config.glowColor);
      initCardInteractions(card, config);
    });

    initSpotlight(sectionEl, cardEls, config);
  };
})();
