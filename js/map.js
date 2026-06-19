/* =============================================================================
   ClickOn · map.js  —  M5 « Ancré dans votre région »
   -----------------------------------------------------------------------------
   Carte SVG custom (pas d'iframe). Au survol / focus clavier d'une ville,
   le panneau d'info se met à jour. Démontre le SEO local et la proximité.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  CO.register("geo", function (root) {
    var cities = root.querySelectorAll(".geo__city");
    var info = {
      city: root.querySelector("[data-geo-city]"),
      meta: root.querySelector("[data-geo-meta]"),
      desc: root.querySelector("[data-geo-desc]")
    };
    if (!cities.length) return;

    function activate(g) {
      cities.forEach(function (c) { c.setAttribute("data-active", "false"); });
      g.setAttribute("data-active", "true");

      var name = g.getAttribute("data-city");
      var pop = g.getAttribute("data-pop");
      var desc = g.getAttribute("data-desc");

      /* petite transition douce sur le panneau (opacity) */
      [info.city, info.meta, info.desc].forEach(function (node) {
        if (!node) return;
        node.style.transition = "opacity 160ms ease";
        node.style.opacity = "0";
      });
      window.setTimeout(function () {
        if (info.city) info.city.textContent = name;
        if (info.meta) info.meta.textContent = "≈ " + pop + " habitants · zone de chalandise active";
        if (info.desc) info.desc.textContent = desc;
        [info.city, info.meta, info.desc].forEach(function (node) { if (node) node.style.opacity = "1"; });
      }, 160);
    }

    cities.forEach(function (g) {
      g.addEventListener("mouseenter", function () { activate(g); });
      g.addEventListener("focus", function () { activate(g); });
      g.addEventListener("click", function () { activate(g); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(g); }
      });
    });
  });
})();
