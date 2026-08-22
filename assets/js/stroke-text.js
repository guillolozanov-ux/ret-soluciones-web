/* StrokeText — puerto vanilla (sin React) del componente StrokeText de
   React Bits: dibuja el contorno de cada carácter con GSAP (stroke-dasharray)
   y luego rellena (wipe o fade). Usa SVG + GSAP globales (ya cargados por
   fold-text.js / gsap CDN), sin dependencias nuevas. */
(function () {
  if (typeof window === 'undefined' || !window.gsap) return;
  var gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function mountStrokeText(container, opts) {
    if (!container) return function () {};
    var config = Object.assign({
      text: 'Draw Attention',
      strokeColor: '#A78BFA',
      fillColor: '#F8FAFC',
      strokeWidth: 1.4,
      drawDuration: 1.6,
      fillDelay: 0.2,
      stagger: 0.05,
      ease: 'power2.out',
      trigger: 'mount',
      fillMode: 'wipe',
      fontSize: 128,
      fontWeight: 800,
      fontFamily: 'inherit',
      letterSpacing: -4,
      lineHeightRatio: 1.3,
      reverse: false
    }, opts || {});

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var characters = Array.prototype.slice.call(String(config.text || ''));
    var dash = Math.max(config.fontSize * 7, 200);
    var wipeId = 'stroke-text-wipe-' + (uid++);

    container.classList.add('stroke-text');
    if (config.trigger === 'hover') container.classList.add('stroke-text--hover');
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', String(config.text || ''));
    container.style.setProperty('--stroke-text-height', Math.round(config.fontSize * config.lineHeightRatio) + 'px');
    container.innerHTML = '';

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'stroke-text__svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 ' + (-config.fontSize) + ' 600 ' + (config.fontSize * config.lineHeightRatio));

    var useWipe = config.fillMode === 'wipe';
    var wipeRect = null;
    if (useWipe) {
      var defs = document.createElementNS(SVG_NS, 'defs');
      var clipPath = document.createElementNS(SVG_NS, 'clipPath');
      clipPath.setAttribute('id', wipeId);
      clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
      wipeRect = document.createElementNS(SVG_NS, 'rect');
      wipeRect.setAttribute('x', '0');
      wipeRect.setAttribute('y', '0');
      wipeRect.setAttribute('width', '0');
      wipeRect.setAttribute('height', config.fontSize * 1.3);
      clipPath.appendChild(wipeRect);
      defs.appendChild(clipPath);
      svg.appendChild(defs);
    }

    var fontStyle = 'font-size:' + config.fontSize + 'px;font-weight:' + config.fontWeight +
      ';letter-spacing:' + config.letterSpacing + 'px;font-family:' + config.fontFamily + ';text-transform:none';

    var strokeText = document.createElementNS(SVG_NS, 'text');
    strokeText.setAttribute('class', 'stroke-text__stroke');
    strokeText.setAttribute('x', '0');
    strokeText.setAttribute('y', '0');
    strokeText.setAttribute('fill', 'none');
    strokeText.setAttribute('stroke', config.strokeColor);
    strokeText.setAttribute('stroke-width', config.strokeWidth);
    strokeText.setAttribute('stroke-linejoin', 'round');
    strokeText.setAttribute('stroke-linecap', 'round');
    strokeText.setAttribute('xml:space', 'preserve');
    strokeText.setAttribute('style', fontStyle);

    var fillText = document.createElementNS(SVG_NS, 'text');
    fillText.setAttribute('class', 'stroke-text__fill');
    fillText.setAttribute('x', '0');
    fillText.setAttribute('y', '0');
    fillText.setAttribute('fill', config.fillColor);
    fillText.setAttribute('stroke', 'none');
    fillText.setAttribute('xml:space', 'preserve');
    fillText.setAttribute('style', fontStyle);
    if (useWipe) fillText.setAttribute('clip-path', 'url(#' + wipeId + ')');

    characters.forEach(function (ch, i) {
      var s = document.createElementNS(SVG_NS, 'tspan');
      s.setAttribute('data-stroke-char', '');
      s.textContent = ch;
      strokeText.appendChild(s);

      var f = document.createElementNS(SVG_NS, 'tspan');
      f.setAttribute('data-fill-char', '');
      f.textContent = ch;
      fillText.appendChild(f);
    });

    svg.appendChild(strokeText);
    svg.appendChild(fillText);
    container.appendChild(svg);

    var destroyed = false;
    var scrollTrigger = null;
    var timeline = null;
    var removeHover = null;

    function measureAndAnimate() {
      if (destroyed) return;
      var bbox;
      try { bbox = strokeText.getBBox(); } catch (e) { return; }
      if (!bbox || !bbox.width) return;

      var pad = Math.max(config.strokeWidth || 1, config.fontSize * 0.1);
      var box = { x: bbox.x - pad, y: bbox.y - pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
      svg.setAttribute('viewBox', box.x + ' ' + box.y + ' ' + box.width + ' ' + box.height);

      var renderedWidth = container.clientWidth;
      if (renderedWidth && box.width) {
        var fitHeight = box.height * (renderedWidth / box.width);
        container.style.setProperty('--stroke-text-height', Math.round(fitHeight) + 'px');
      }
      if (wipeRect) {
        wipeRect.setAttribute('x', box.x);
        wipeRect.setAttribute('y', box.y);
        wipeRect.setAttribute('height', box.height);
        wipeRect.setAttribute('width', '0');
      }

      var strokes = Array.prototype.slice.call(strokeText.querySelectorAll('[data-stroke-char]'));
      var fills = Array.prototype.slice.call(fillText.querySelectorAll('[data-fill-char]'));
      if (!strokes.length) return;

      var fillEnabled = config.fillMode !== 'none';
      var fillDuration = Math.max(0.4, config.drawDuration * 0.5);
      var staggerConfig = config.reverse ? { each: config.stagger, from: 'end' } : config.stagger;

      var setStart = function () {
        gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
        gsap.set(fills, { opacity: useWipe ? 1 : 0 });
        if (wipeRect) gsap.set(wipeRect, { attr: { width: 0 } });
      };
      var setEnd = function () {
        gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
        gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
        if (wipeRect) gsap.set(wipeRect, { attr: { width: fillEnabled ? box.width : 0 } });
      };

      if (reduceMotion) { setEnd(); return; }

      var build = function () {
        setStart();
        var tl = gsap.timeline({ paused: true, repeat: config.trigger === 'loop' ? -1 : 0, repeatDelay: config.trigger === 'loop' ? 0.9 : 0 });
        tl.to(strokes, { strokeDashoffset: 0, duration: config.drawDuration, ease: config.ease, stagger: staggerConfig }, 0);
        if (useWipe && wipeRect) {
          tl.to(wipeRect, { attr: { width: box.width }, duration: fillDuration, ease: 'power2.inOut' }, config.drawDuration + config.fillDelay);
        } else if (fillEnabled) {
          tl.to(fills, { opacity: 1, duration: fillDuration, ease: 'power2.out', stagger: staggerConfig }, config.drawDuration + config.fillDelay);
        }
        return tl;
      };

      if (config.trigger === 'hover') {
        setEnd();
        var play = function () { if (timeline) timeline.kill(); timeline = build(); timeline.play(0); };
        container.addEventListener('pointerenter', play);
        removeHover = function () { container.removeEventListener('pointerenter', play); };
      } else {
        timeline = build();
        if (config.trigger === 'scroll' && window.ScrollTrigger) {
          scrollTrigger = window.ScrollTrigger.create({
            trigger: container, start: 'top 82%', once: true, onEnter: function () { timeline.play(0); }
          });
        } else {
          timeline.play(0);
        }
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureAndAnimate).catch(measureAndAnimate);
    } else {
      measureAndAnimate();
    }

    return function destroy() {
      destroyed = true;
      if (removeHover) removeHover();
      if (scrollTrigger) scrollTrigger.kill();
      if (timeline) timeline.kill();
    };
  }

  window.mountStrokeText = mountStrokeText;
})();
