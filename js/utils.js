/* =============================================================================
   ClickOn · utils.js
   -----------------------------------------------------------------------------
   Socle réutilisable partagé par tous les modules. Expose un petit namespace
   global `ClickOn` : helpers maths, throttle rAF, observers, et un registre
   de modules (lazy-init quand le bloc approche du viewport → performance).
   Aucune dépendance. Scripts classiques, donc chargés via window.ClickOn.
   ========================================================================== */
(function (window, document) {
  "use strict";

  /* --- Maths ------------------------------------------------------------- */
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  /* Remappe x de [inMin,inMax] vers [outMin,outMax], borné. */
  var mapRange = function (x, inMin, inMax, outMin, outMax) {
    var t = clamp((x - inMin) / (inMax - inMin), 0, 1);
    return lerp(outMin, outMax, t);
  };
  /* Interpolation douce entre deux couleurs hex (#rrggbb). */
  var mixHex = function (a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    var br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    var r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
    return "rgb(" + r + "," + g + "," + bl + ")";
  };

  /* --- Préférence de mouvement (réévaluée à chaque appel) ---------------- */
  var reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var prefersReducedMotion = function () { return reducedMotionMQ.matches; };

  /* --- Throttle via requestAnimationFrame -------------------------------- */
  /* Garantit au plus un appel par frame. Idéal pour scroll/mousemove. */
  var rafThrottle = function (fn) {
    var queued = false, lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        fn.apply(null, lastArgs);
      });
    };
  };

  /* --- IntersectionObserver : exécute un callback à l'entrée du viewport -- */
  var onView = function (el, cb, options) {
    if (!("IntersectionObserver" in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { cb(entry.target); io.unobserve(entry.target); }
      });
    }, options || { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    io.observe(el);
    return io;
  };

  /* --- Registre de modules ---------------------------------------------- */
  /* Chaque fichier de module appelle ClickOn.register('nom', initFn).
     main.js déclenche initFn(rootEl) quand le bloc [data-module="nom"]
     entre en vue — on ne paie le coût qu'au moment utile. */
  var registry = {};
  var register = function (name, initFn) { registry[name] = initFn; };
  var getRegistry = function () { return registry; };

  /* --- Petit util : exécuter quand le DOM est prêt ----------------------- */
  var ready = function (fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  };

  /* Exposition du namespace */
  window.ClickOn = {
    clamp: clamp,
    lerp: lerp,
    mapRange: mapRange,
    mixHex: mixHex,
    prefersReducedMotion: prefersReducedMotion,
    rafThrottle: rafThrottle,
    onView: onView,
    register: register,
    getRegistry: getRegistry,
    ready: ready
  };
})(window, document);
