/* RET — Aviso de cookies. Muestra el banner solo si el visitante no ha
   decidido antes (persistido en localStorage); Aceptar/Rechazar lo cierran
   y guardan la elección. */
(function () {
  'use strict';
  var KEY = 'ret-cookie-consent';

  function mount() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;

    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (stored) return;

    banner.hidden = false;
    requestAnimationFrame(function () { banner.classList.add('is-visible'); });

    function close(value) {
      try { localStorage.setItem(KEY, value); } catch (e) {}
      banner.classList.remove('is-visible');
      window.setTimeout(function () { banner.hidden = true; }, 320);
    }

    var acceptBtn = document.getElementById('cookie-accept');
    var rejectBtn = document.getElementById('cookie-reject');
    if (acceptBtn) acceptBtn.addEventListener('click', function () { close('accepted'); });
    if (rejectBtn) rejectBtn.addEventListener('click', function () { close('rejected'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
