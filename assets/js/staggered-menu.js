/* RET — StaggeredMenu, puerto vanilla (sin React) del componente StaggeredMenu
   de React Bits: panel de navegación mobile con capas de color escalonadas,
   items con entrada stagger, numeración y ícono +/x animado. Usa GSAP global
   (ya cargado por otros efectos del sitio), sin dependencias nuevas. Sustituye
   el toggle-button existente (#nav-toggle) y monta su propio panel en <body>. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.gsap) return;
  var gsap = window.gsap;

  function mountStaggeredMenu(toggleBtn, opts) {
    if (!toggleBtn) return function () {};
    var config = Object.assign({
      position: 'right',
      colors: ['#0C8998', '#2BB7C0'],
      items: [],
      socialItems: [],
      displaySocials: true,
      displayItemNumbering: true,
      menuButtonColor: '#FDFDFC',
      openMenuButtonColor: '#FDFDFC',
      accentColor: '#2BB7C0',
      changeMenuColorOnOpen: true,
      closeOnClickAway: true,
      onMenuOpen: null,
      onMenuClose: null
    }, opts || {});

    var open = false;
    var busy = false;

    var openTl = null, closeTween = null, spinTween = null, textCycleAnim = null, colorTween = null;

    /* ---- build toggle button internals ---- */
    toggleBtn.classList.add('sm-toggle');
    toggleBtn.innerHTML =
      '<span class="sm-toggle-textWrap" aria-hidden="true"><span class="sm-toggle-textInner">' +
        '<span class="sm-toggle-line">Menú</span>' +
      '</span></span>' +
      '<span class="sm-icon"><span class="sm-icon-line"></span><span class="sm-icon-line sm-icon-line-v"></span></span>';
    var textInner = toggleBtn.querySelector('.sm-toggle-textInner');
    var icon = toggleBtn.querySelector('.sm-icon');
    var plusH = toggleBtn.querySelector('.sm-icon-line');
    var plusV = toggleBtn.querySelector('.sm-icon-line-v');

    /* ---- build overlay: prelayers + panel ---- */
    var wrapper = document.createElement('div');
    wrapper.className = 'staggered-menu-wrapper';
    wrapper.setAttribute('data-position', config.position);
    if (config.accentColor) wrapper.style.setProperty('--sm-accent', config.accentColor);

    var preLayers = document.createElement('div');
    preLayers.className = 'sm-prelayers';
    preLayers.setAttribute('aria-hidden', 'true');
    var colorArr = (config.colors && config.colors.length ? config.colors.slice(0, 4) : ['#1e1e22', '#35353c']).slice();
    if (colorArr.length >= 3) colorArr.splice(Math.floor(colorArr.length / 2), 1);
    colorArr.forEach(function (c) {
      var layer = document.createElement('div');
      layer.className = 'sm-prelayer';
      layer.style.background = c;
      preLayers.appendChild(layer);
    });

    var panel = document.createElement('aside');
    panel.id = 'staggered-menu-panel';
    panel.className = 'staggered-menu-panel';
    panel.setAttribute('aria-hidden', 'true');

    var panelInner = document.createElement('div');
    panelInner.className = 'sm-panel-inner';

    var list = document.createElement('ul');
    list.className = 'sm-panel-list';
    list.setAttribute('role', 'list');
    if (config.displayItemNumbering) list.setAttribute('data-numbering', 'true');
    /* Página actual, para autoexpandir el grupo que la contiene y marcar el hijo activo. */
    var currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

    var subGroups = [];
    var subId = 0;

    (config.items || []).forEach(function (it, idx) {
      var li = document.createElement('li');
      li.className = 'sm-panel-itemWrap';
      var kids = it.children && it.children.length ? it.children : null;

      /* Un item con children se vuelve botón acordeón en vez de enlace: el panel
         mobile no tiene hover, así que el submenú se abre por tap. */
      var trigger = document.createElement(kids ? 'button' : 'a');
      trigger.className = 'sm-panel-item';
      if (kids) {
        trigger.type = 'button';
        trigger.classList.add('sm-panel-item--parent');
      } else {
        trigger.href = it.link || '#';
      }
      if (it.ariaLabel) trigger.setAttribute('aria-label', it.ariaLabel);
      trigger.setAttribute('data-index', idx + 1);

      var label = document.createElement('span');
      label.className = 'sm-panel-itemLabel';
      label.appendChild(document.createTextNode(it.label));
      if (kids) {
        var caret = document.createElement('span');
        caret.className = 'sm-panel-caret';
        caret.setAttribute('aria-hidden', 'true');
        label.appendChild(caret);
      }
      trigger.appendChild(label);
      li.appendChild(trigger);

      if (kids) {
        li.classList.add('sm-panel-itemWrap--parent');
        var sub = document.createElement('ul');
        sub.className = 'sm-panel-sublist';
        sub.id = 'sm-sub-' + (++subId);
        sub.setAttribute('role', 'list');
        var hasCurrent = false;
        kids.forEach(function (kid) {
          var kLi = document.createElement('li');
          kLi.className = 'sm-panel-subitemWrap';
          var kA = document.createElement('a');
          kA.className = 'sm-panel-subitem';
          kA.href = kid.link || '#';
          if (kid.ariaLabel) kA.setAttribute('aria-label', kid.ariaLabel);
          if ((kid.link || '').toLowerCase() === currentPage) {
            kA.classList.add('is-active');
            kA.setAttribute('aria-current', 'page');
            hasCurrent = true;
          }
          kA.textContent = kid.label;
          kLi.appendChild(kA);
          sub.appendChild(kLi);
        });
        trigger.setAttribute('aria-controls', sub.id);
        trigger.setAttribute('aria-expanded', hasCurrent ? 'true' : 'false');
        if (hasCurrent) li.classList.add('is-expanded');
        else sub.hidden = true;
        li.appendChild(sub);
        subGroups.push({ trigger: trigger, sub: sub, li: li });
      }

      list.appendChild(li);
    });
    panelInner.appendChild(list);

    /* Acordeón: alto animado con GSAP; `hidden` mantiene los enlaces fuera del
       foco cuando está cerrado. */
    subGroups.forEach(function (g) {
      g.trigger.addEventListener('click', function () {
        var expanded = g.trigger.getAttribute('aria-expanded') === 'true';
        gsap.killTweensOf(g.sub);
        if (expanded) {
          gsap.to(g.sub, {
            height: 0, opacity: 0, duration: 0.3, ease: 'power3.inOut',
            onComplete: function () { g.sub.hidden = true; gsap.set(g.sub, { clearProps: 'height,opacity' }); }
          });
        } else {
          g.sub.hidden = false;
          gsap.set(g.sub, { height: 'auto', opacity: 1 });
          gsap.from(g.sub, { height: 0, opacity: 0, duration: 0.38, ease: 'power3.out',
            onComplete: function () { gsap.set(g.sub, { clearProps: 'height' }); } });
        }
        g.trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        g.li.classList.toggle('is-expanded', !expanded);
      });
    });

    if (config.displaySocials && config.socialItems && config.socialItems.length) {
      var socials = document.createElement('div');
      socials.className = 'sm-socials';
      socials.setAttribute('aria-label', 'Redes sociales');
      var title = document.createElement('h3');
      title.className = 'sm-socials-title';
      title.textContent = 'Síguenos';
      socials.appendChild(title);
      var sList = document.createElement('ul');
      sList.className = 'sm-socials-list';
      sList.setAttribute('role', 'list');
      config.socialItems.forEach(function (s) {
        var li = document.createElement('li');
        li.className = 'sm-socials-item';
        var a = document.createElement('a');
        a.href = s.link || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'sm-socials-link';
        a.textContent = s.label;
        li.appendChild(a);
        sList.appendChild(li);
      });
      socials.appendChild(sList);
      panelInner.appendChild(socials);
    }

    panel.appendChild(panelInner);
    wrapper.appendChild(preLayers);
    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    var preLayerEls = Array.prototype.slice.call(preLayers.querySelectorAll('.sm-prelayer'));
    var offscreen = config.position === 'left' ? -100 : 100;

    gsap.set([panel].concat(preLayerEls), { xPercent: offscreen });
    gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
    gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
    gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
    gsap.set(toggleBtn, { color: config.menuButtonColor });

    function buildOpenTimeline() {
      openTl && openTl.kill();
      if (closeTween) { closeTween.kill(); closeTween = null; }

      var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-itemLabel'));
      var numberEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
      var socialTitle = panel.querySelector('.sm-socials-title');
      var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));

      if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
      if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
      if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
      if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

      var tl = gsap.timeline({ paused: true });
      preLayerEls.forEach(function (el, i) {
        tl.fromTo(el, { xPercent: offscreen }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
      });
      var lastTime = preLayerEls.length ? (preLayerEls.length - 1) * 0.07 : 0;
      var panelInsertTime = lastTime + (preLayerEls.length ? 0.08 : 0);
      var panelDuration = 0.65;
      tl.fromTo(panel, { xPercent: offscreen }, { xPercent: 0, duration: panelDuration, ease: 'power4.out' }, panelInsertTime);

      if (itemEls.length) {
        var itemsStart = panelInsertTime + panelDuration * 0.15;
        tl.to(itemEls, { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: { each: 0.1, from: 'start' } }, itemsStart);
        if (numberEls.length) {
          tl.to(numberEls, { duration: 0.6, ease: 'power2.out', '--sm-num-opacity': 1, stagger: { each: 0.08, from: 'start' } }, itemsStart + 0.1);
        }
      }
      var openSubs = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-sublist:not([hidden])'));
      if (openSubs.length) {
        gsap.set(openSubs, { opacity: 0 });
        tl.to(openSubs, { opacity: 1, duration: 0.5, ease: 'power2.out' }, panelInsertTime + panelDuration * 0.35);
      }
      if (socialTitle || socialLinks.length) {
        var socialsStart = panelInsertTime + panelDuration * 0.4;
        if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socialsStart);
        if (socialLinks.length) {
          tl.to(socialLinks, {
            y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: { each: 0.08, from: 'start' },
            onComplete: function () { gsap.set(socialLinks, { clearProps: 'opacity' }); }
          }, socialsStart + 0.04);
        }
      }
      openTl = tl;
      return tl;
    }

    function playOpen() {
      if (busy) return;
      busy = true;
      var tl = buildOpenTimeline();
      tl.eventCallback('onComplete', function () { busy = false; });
      tl.play(0);
    }

    function playClose() {
      openTl && openTl.kill();
      openTl = null;
      var all = preLayerEls.concat([panel]);
      closeTween && closeTween.kill();
      closeTween = gsap.to(all, {
        xPercent: offscreen, duration: 0.32, ease: 'power3.in', overwrite: 'auto',
        onComplete: function () {
          var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-itemLabel'));
          if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
          var numberEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
          if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
          var socialTitle = panel.querySelector('.sm-socials-title');
          var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));
          if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
          if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
          var openSubs = Array.prototype.slice.call(panel.querySelectorAll('.sm-panel-sublist:not([hidden])'));
          if (openSubs.length) gsap.set(openSubs, { opacity: 0 });
          busy = false;
        }
      });
    }

    function animateIcon(opening) {
      spinTween && spinTween.kill();
      spinTween = gsap.to(icon, opening
        ? { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' }
        : { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
    }

    function animateColor(opening) {
      colorTween && colorTween.kill();
      if (config.changeMenuColorOnOpen) {
        colorTween = gsap.to(toggleBtn, { color: opening ? config.openMenuButtonColor : config.menuButtonColor, delay: 0.18, duration: 0.3, ease: 'power2.out' });
      } else {
        gsap.set(toggleBtn, { color: config.menuButtonColor });
      }
    }

    function animateText(opening) {
      textCycleAnim && textCycleAnim.kill();
      var currentLabel = opening ? 'Menú' : 'Cerrar';
      var targetLabel = opening ? 'Cerrar' : 'Menú';
      var cycles = 3;
      var seq = [currentLabel];
      var last = currentLabel;
      for (var i = 0; i < cycles; i++) {
        last = last === 'Menú' ? 'Cerrar' : 'Menú';
        seq.push(last);
      }
      if (last !== targetLabel) seq.push(targetLabel);
      seq.push(targetLabel);

      textInner.innerHTML = seq.map(function (l) { return '<span class="sm-toggle-line">' + l + '</span>'; }).join('');
      gsap.set(textInner, { yPercent: 0 });
      var finalShift = ((seq.length - 1) / seq.length) * 100;
      textCycleAnim = gsap.to(textInner, { yPercent: -finalShift, duration: 0.5 + seq.length * 0.07, ease: 'power4.out' });
    }

    function toggleMenu() {
      var target = !open;
      open = target;
      toggleBtn.setAttribute('aria-expanded', target ? 'true' : 'false');
      panel.setAttribute('aria-hidden', target ? 'false' : 'true');
      wrapper.setAttribute('data-open', target ? 'true' : '');
      if (target) {
        config.onMenuOpen && config.onMenuOpen();
        playOpen();
      } else {
        config.onMenuClose && config.onMenuClose();
        playClose();
      }
      animateIcon(target);
      animateColor(target);
      animateText(target);
    }

    function closeMenu() {
      if (!open) return;
      open = false;
      toggleBtn.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
      wrapper.removeAttribute('data-open');
      config.onMenuClose && config.onMenuClose();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }

    toggleBtn.setAttribute('aria-controls', 'staggered-menu-panel');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.addEventListener('click', toggleMenu);

    if (config.closeOnClickAway) {
      document.addEventListener('mousedown', function (e) {
        if (!open) return;
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) closeMenu();
      });
    }

    return { open: function () { if (!open) toggleMenu(); }, close: closeMenu, toggle: toggleMenu };
  }

  window.mountStaggeredMenu = mountStaggeredMenu;
})();
