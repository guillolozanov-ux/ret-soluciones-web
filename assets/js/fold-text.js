/* Fold-text — puerto vanilla del componente FoldText (React Bits) para el sitio
   estático de RET. Sin React: opera directo sobre los títulos display existentes
   (.h-display) dividiéndolos en piezas que se "despliegan" con GSAP al entrar en
   pantalla. Curva y duración alineadas a las del sistema (--ease-out-strong). */
(function () {
  if (typeof window === 'undefined' || !window.gsap) return;
  var gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  var HINGE = { origin: '50% 0%', rotateX: -92, rotateY: 0 };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function splitTextNode(node) {
    var text = node.textContent;
    var frag = document.createDocumentFragment();
    // Group characters by word, each inside a white-space:nowrap wrapper, so
    // the line can only break between words (or at <br>) — adjacent
    // inline-block glyphs with no space between them are otherwise a valid
    // browser break point and words fragment mid-character.
    var parts = text.split(/(\s+)/);
    parts.forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        return;
      }
      var word = document.createElement('span');
      word.className = 'fold-text-word';
      Array.prototype.forEach.call(part, function (ch) {
        var seg = document.createElement('span');
        seg.className = 'fold-text-segment';
        var piece = document.createElement('span');
        piece.className = 'fold-text-piece';
        piece.textContent = ch;
        seg.appendChild(piece);
        word.appendChild(seg);
      });
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  }

  function splitTextNodesIn(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (n.textContent && n.textContent.length) nodes.push(n);
    }
    nodes.forEach(splitTextNode);
  }

  function initFoldText(el) {
    if (el.dataset.foldInit) return;
    el.dataset.foldInit = '1';

    var originalText = el.textContent;
    var originalHTML = el.innerHTML;
    el.innerHTML = '';

    var sr = document.createElement('span');
    sr.className = 'fold-text-sr-only';
    sr.textContent = originalText;

    var visual = document.createElement('span');
    visual.className = 'fold-text-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = originalHTML;

    el.appendChild(sr);
    el.appendChild(visual);
    splitTextNodesIn(visual);

    var pieces = visual.querySelectorAll('.fold-text-piece');
    if (!pieces.length) return;

    if (reduceMotion) {
      gsap.set(pieces, { opacity: 1, rotateX: 0 });
      return;
    }

    gsap.set(pieces, {
      opacity: 0,
      rotateX: HINGE.rotateX,
      transformOrigin: HINGE.origin,
      force3D: true
    });

    var play = function () {
      gsap.to(pieces, {
        opacity: 1,
        rotateX: 0,
        duration: 0.65,
        ease: 'power3.out',
        stagger: 0.035,
        clearProps: 'willChange'
      });
    };

    if (window.ScrollTrigger) {
      window.ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: play
      });
    } else {
      play();
    }
  }

  function init() {
    var titles = document.querySelectorAll('.h-display');
    titles.forEach(initFoldText);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
