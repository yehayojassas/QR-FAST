/* =============================================================================
   ClickOn · compare.js  —  M6 ★ « L'écart, sans un mot »
   -----------------------------------------------------------------------------
   Comparateur avant/après par clip-path. Le glissement s'appuie sur un input
   range natif superposé (invisible) : on récupère GRATUITEMENT la souris, le
   tactile ET le clavier (flèches), donc l'accessibilité. La position pilote
   la variable CSS --pos. Un bouton révèle les différences (transition FLIP-like).
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  CO.register("compare", function (root) {
    var viewport = root.querySelector("[data-compare]");
    var range = root.querySelector("[data-compare-range]");
    var diffBtn = root.querySelector("[data-compare-diff]");
    if (!viewport || !range) return;

    /* Position du curseur → clip-path + poignée (une seule variable). */
    function setPos(pct) {
      viewport.style.setProperty("--pos", pct + "%");
    }
    setPos(parseFloat(range.value));

    /* Le range natif gère souris, tactile et clavier d'un coup. */
    range.addEventListener("input", function () {
      setPos(parseFloat(range.value));
    });

    /* Petit confort : un clic sur la poignée ne « saute » pas brutalement,
       on laisse le range natif faire — mais on enlève le focus visuel parasite
       après un clic souris (le focus clavier reste géré par :focus-visible). */
    range.addEventListener("pointerup", function () { range.blur(); });

    /* Révéler les différences (pastilles en scale-in décalé via CSS). */
    if (diffBtn) {
      diffBtn.addEventListener("click", function () {
        var on = root.classList.toggle("show-diff");
        diffBtn.setAttribute("aria-pressed", on ? "true" : "false");
        diffBtn.textContent = on ? "Masquer les différences" : "Voir les différences";
      });
    }
  });
})();
