/* =============================================================================
   ClickOn · hero.js  —  M1 « La première impression en 3 secondes »
   -----------------------------------------------------------------------------
   Scroll-driven : sticky pinning + parallaxe (var --p) + lever de rideau
   (var --curtain). Au chargement, un compte à rebours de 3 s matérialise
   « un visiteur décide en 3 secondes ». Respecte prefers-reduced-motion.
   Bloc autonome : il ne dépend que de ClickOn (utils.js).
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  CO.register("hero", function (root) {
    var stage = root.querySelector(".hero__stage");
    var timerEl = root.querySelector("[data-hero-timer]");
    var reduced = CO.prefersReducedMotion();

    /* 1) Révélation des mots (masque vertical) dès l'entrée en vue. */
    root.classList.add("is-armed");

    /* 2) Compte à rebours « 3,0 s » au chargement (matérialise la promesse). */
    if (timerEl) {
      if (reduced) {
        timerEl.textContent = "3,0";
      } else {
        var duration = 3000, start = null;
        var tick = function (ts) {
          if (start === null) start = ts;
          var elapsed = ts - start;
          var remaining = Math.max(0, duration - elapsed) / 1000;
          timerEl.textContent = remaining.toFixed(1).replace(".", ",");
          if (elapsed < duration) {
            window.requestAnimationFrame(tick);
          } else {
            var label = timerEl.parentNode;
            if (label) label.innerHTML = "Trop tard : <b>il a déjà décidé.</b>";
          }
        };
        window.requestAnimationFrame(tick);
      }
    }

    /* 3) Progression de scroll → parallaxe + rideau. */
    if (reduced) {
      /* En mouvement réduit : on montre directement l'état « rideau levé ». */
      root.style.setProperty("--curtain", "1");
      return;
    }

    var update = CO.rafThrottle(function () {
      var rect = root.getBoundingClientRect();
      var scrollable = root.offsetHeight - window.innerHeight;
      var progress = CO.clamp(-rect.top / scrollable, 0, 1);

      root.style.setProperty("--p", progress.toFixed(4));

      /* Le rideau monte sur le dernier tiers du défilé (0.4 → 1). */
      var curtain = CO.mapRange(progress, 0.4, 1, 0, 1);
      root.style.setProperty("--curtain", curtain.toFixed(4));
    });

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  });
})();
