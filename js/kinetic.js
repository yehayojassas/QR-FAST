/* =============================================================================
   ClickOn · kinetic.js  —  M4 « Votre marque, pas un template »
   -----------------------------------------------------------------------------
   Typographie cinétique : un mot-métier qui se transforme (masque vertical +
   axes de variable font animés), et des marquees pilotés au scroll.
   Démontre qu'une identité locale forte se construit. Respecte reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  /* Métiers volontairement « masculins » → l'article « un » reste valide.
     Tous très « PME romande ». */
  var TRADES = ["garage", "restaurant", "fitness", "salon de coiffure",
                "caviste", "opticien", "fleuriste", "boucher"];

  CO.register("kinetic", function (root) {
    var rotator = root.querySelector("[data-kinetic-rotator]");
    var word = rotator ? rotator.querySelector(".kinetic__word") : null;
    var marquees = root.querySelectorAll(".kinetic__marquee span");
    var reduced = CO.prefersReducedMotion();
    var i = 0;

    /* --- Rotation du mot --------------------------------------------------- */
    if (word) {
      if (reduced) {
        /* Mouvement réduit : on change juste le texte, sans animation. */
        window.setInterval(function () {
          i = (i + 1) % TRADES.length;
          word.textContent = TRADES[i];
        }, 2600);
      } else {
        var swap = function () {
          /* phase sortie : le mot monte et s'efface */
          word.style.transition = "transform 380ms cubic-bezier(0.16,1,0.3,1), opacity 380ms ease";
          word.style.transform = "translateY(-115%)";
          word.style.opacity = "0";

          window.setTimeout(function () {
            /* swap + repositionnement instantané sous la ligne */
            i = (i + 1) % TRADES.length;
            word.textContent = TRADES[i];
            word.style.transition = "none";
            word.style.transform = "translateY(115%)";
            /* graisse variable qui « respire » à chaque mot */
            var wght = 480 + (i % 3) * 90;
            rotator.style.fontVariationSettings = '"opsz" 144, "wght" ' + wght + ', "SOFT" ' + (i % 2 ? 40 : 0);
            /* reflow forcé pour rejouer la transition */
            void word.offsetWidth;
            /* phase entrée : le nouveau mot remonte en place */
            word.style.transition = "transform 520ms cubic-bezier(0.16,1,0.3,1), opacity 520ms ease";
            word.style.transform = "translateY(0)";
            word.style.opacity = "1";
          }, 400);
        };
        window.setInterval(swap, 2600);
      }
    }

    /* --- Marquees pilotés au scroll --------------------------------------- */
    if (marquees.length && !reduced) {
      var onScroll = CO.rafThrottle(function () {
        var rect = root.getBoundingClientRect();
        /* progression de la section dans le viewport : -1 (sous) → 1 (au-dessus) */
        var p = CO.clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
        var shift = (p - 0.5) * 480; // amplitude du défilement horizontal
        marquees.forEach(function (m, idx) {
          var dir = idx % 2 === 0 ? -1 : 1; // haut ↔ bas en sens opposés
          m.style.transform = "translateX(" + (shift * dir) + "px)";
        });
      });
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
  });
})();
