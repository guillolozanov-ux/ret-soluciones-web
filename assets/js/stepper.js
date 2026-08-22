/* RET — Stepper, puerto vanilla (sin React/Motion) del componente Stepper de
   React Bits: fila de indicadores numerados + conector progresivo + contenido
   que desliza entre pasos, navegado con Atrás/Siguiente. Sin dependencias:
   usa solo CSS transitions (no gsap ni motion). Lee su contenido directo de
   una <table> existente (thead/tbody) para no duplicar datos, y se muestra
   solo en el breakpoint mobile vía CSS (la tabla original sigue siendo la
   fuente de verdad en desktop). */
(function () {
  'use strict';

  var SEV_COLOR = {
    critica: '#E5484D',
    alta: '#F28C2B',
    media: '#E8B90A',
    baja: '#35A877'
  };

  function mountStepper(table, opts) {
    if (!table) return function () {};
    var config = Object.assign({ initialStep: 1 }, opts || {});

    var headRow = table.querySelector('thead tr');
    var bodyRows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    if (!headRow || !bodyRows.length) return function () {};

    var colLabels = Array.prototype.slice.call(headRow.querySelectorAll('th')).slice(1).map(function (th) {
      return th.textContent.trim();
    });

    var steps = bodyRows.map(function (tr) {
      var tds = Array.prototype.slice.call(tr.querySelectorAll('td'));
      var sevMatch = /sev-(\w+)/.exec(tr.className);
      return {
        label: tds[0] ? tds[0].textContent.trim() : '',
        sev: sevMatch ? sevMatch[1] : '',
        color: sevMatch ? SEV_COLOR[sevMatch[1]] : null,
        values: tds.slice(1).map(function (td) { return td.textContent.trim(); })
      };
    });

    var total = steps.length;
    var current = Math.min(Math.max(config.initialStep, 1), total);
    var direction = 0;
    var busy = false;

    var root = document.createElement('div');
    root.className = 'stepper';

    var indRow = document.createElement('div');
    indRow.className = 'stepper-indicators';
    var circles = [];
    var connectors = [];
    steps.forEach(function (s, i) {
      var circle = document.createElement('button');
      circle.type = 'button';
      circle.className = 'stepper-dot';
      circle.setAttribute('aria-label', s.label);
      circle.innerHTML = '<span class="stepper-dot-inner">' + (i + 1) + '</span>';
      circle.addEventListener('click', function () { goTo(i + 1); });
      indRow.appendChild(circle);
      circles.push(circle);
      if (i < steps.length - 1) {
        var conn = document.createElement('div');
        conn.className = 'stepper-connector';
        conn.innerHTML = '<span class="stepper-connector-fill"></span>';
        indRow.appendChild(conn);
        connectors.push(conn);
      }
    });

    var viewport = document.createElement('div');
    viewport.className = 'stepper-viewport';
    var track = document.createElement('div');
    track.className = 'stepper-track';
    viewport.appendChild(track);

    var footer = document.createElement('div');
    footer.className = 'stepper-footer';
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'stepper-nav-btn stepper-back';
    backBtn.textContent = 'Atrás';
    backBtn.addEventListener('click', function () { goTo(current - 1); });
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'stepper-nav-btn stepper-next';
    nextBtn.textContent = 'Siguiente';
    nextBtn.addEventListener('click', function () { goTo(current + 1); });
    footer.appendChild(backBtn);
    footer.appendChild(nextBtn);

    root.appendChild(indRow);
    root.appendChild(viewport);
    root.appendChild(footer);
    var anchor = table.closest('.data-table-wrap') || table;
    anchor.parentNode.insertBefore(root, anchor.nextSibling);

    function buildSlide(stepIdx) {
      var s = steps[stepIdx];
      var slide = document.createElement('div');
      slide.className = 'stepper-slide';
      if (s.color) slide.style.setProperty('--stepper-accent', s.color);
      var badge = document.createElement('div');
      badge.className = 'stepper-slide-badge';
      badge.textContent = s.label;
      slide.appendChild(badge);
      var rows = document.createElement('dl');
      rows.className = 'stepper-slide-rows';
      colLabels.forEach(function (label, i) {
        var dt = document.createElement('dt');
        dt.textContent = label;
        var dd = document.createElement('dd');
        dd.textContent = s.values[i] || '';
        rows.appendChild(dt);
        rows.appendChild(dd);
      });
      slide.appendChild(rows);
      return slide;
    }

    function render(withTransition) {
      var idx = current - 1;
      var incoming = buildSlide(idx);
      var outgoing = track.querySelector('.stepper-slide');

      circles.forEach(function (c, i) {
        c.classList.toggle('is-active', i === idx);
        c.classList.toggle('is-complete', i < idx);
        if (steps[i].color) c.style.setProperty('--stepper-accent', steps[i].color);
      });
      connectors.forEach(function (conn, i) {
        conn.querySelector('.stepper-connector-fill').style.width = (i < idx ? '100%' : '0%');
      });
      backBtn.hidden = current === 1;
      nextBtn.hidden = current === total;

      if (!withTransition || !outgoing) {
        if (outgoing) outgoing.remove();
        track.appendChild(incoming);
        requestAnimationFrame(function () { incoming.classList.add('is-current'); });
        return;
      }

      busy = true;
      var enterFrom = direction >= 0 ? '100%' : '-100%';
      var exitTo = direction >= 0 ? '-30%' : '30%';
      incoming.style.transform = 'translateX(' + enterFrom + ')';
      incoming.style.opacity = '0';
      track.appendChild(incoming);
      outgoing.classList.remove('is-current');
      outgoing.style.transform = 'translateX(0)';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          outgoing.style.transform = 'translateX(' + exitTo + ')';
          outgoing.style.opacity = '0';
          incoming.style.transform = 'translateX(0)';
          incoming.style.opacity = '1';
          incoming.classList.add('is-current');
        });
      });

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        outgoing.remove();
        busy = false;
      };
      outgoing.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 450);
    }

    function goTo(n) {
      if (busy) return;
      n = Math.min(Math.max(n, 1), total);
      if (n === current) return;
      direction = n > current ? 1 : -1;
      current = n;
      render(true);
    }

    render(false);

    return { goTo: goTo, root: root };
  }

  window.mountStepper = mountStepper;
})();
