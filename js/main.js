/* =============================================================================
   ClickOn · main.js  —  Orchestration de la coquille
   -----------------------------------------------------------------------------
   Relie la galerie aux œuvres :
     · état « scrollé » de l'en-tête + barre de progression de lecture ;
     · navigation mobile (ouvre/ferme, voile, Échap, fermeture au clic) ;
     · scrollspy → met en évidence l'entrée active de la table des possibilités ;
     · révélations à l'entrée du viewport (.reveal) ;
     · INIT PARESSEUSE des modules : on ne paie le coût qu'à l'approche du bloc.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  CO.ready(function () {
    var registry = CO.getRegistry();

    /* --- Année dynamique dans le pied de page ---------------------------- */
    var yearEl = document.querySelector("[data-year]");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* --- En-tête : état scrollé + barre de progression ------------------- */
    var header = document.querySelector(".site-header");
    var progress = document.querySelector(".read-progress");
    var onScrollChrome = CO.rafThrottle(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (header) header.setAttribute("data-scrolled", y > 8 ? "true" : "false");
      if (progress) {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        progress.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : "0");
      }
    });
    onScrollChrome();
    window.addEventListener("scroll", onScrollChrome, { passive: true });
    window.addEventListener("resize", onScrollChrome);

    /* --- Navigation mobile ----------------------------------------------- */
    var nav = document.getElementById("nav-index");
    var toggle = document.querySelector(".nav-toggle");
    var scrim = document.querySelector(".nav-scrim");

    function setNav(open) {
      if (nav) nav.setAttribute("data-open", open ? "true" : "false");
      if (scrim) scrim.setAttribute("data-open", open ? "true" : "false");
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    }
    if (toggle) toggle.addEventListener("click", function () {
      setNav(nav.getAttribute("data-open") !== "true");
    });
    if (scrim) scrim.addEventListener("click", function () { setNav(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setNav(false);
    });
    /* Fermer la nav après un clic sur un lien (mobile). */
    if (nav) nav.querySelectorAll(".nav-index__link").forEach(function (a) {
      a.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 1079px)").matches) setNav(false);
      });
    });

    /* --- Scrollspy : entrée active de la table des possibilités ---------- */
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav-index__link"));
    var byId = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (id) byId[id] = a;
    });
    var targets = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);

    if ("IntersectionObserver" in window && targets.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          links.forEach(function (a) { a.setAttribute("aria-current", "false"); });
          if (byId[id]) byId[id].setAttribute("aria-current", "true");
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      targets.forEach(function (t) { spy.observe(t); });
    }

    /* --- Révélations (.reveal) ------------------------------------------- */
    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !CO.prefersReducedMotion()) {
      var revealIO = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = el.getAttribute("data-reveal-delay");
          if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
          el.classList.add("is-visible");
          obs.unobserve(el);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
      reveals.forEach(function (el) { revealIO.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }

    /* --- Init paresseuse des modules ------------------------------------- */
    /* Chaque [data-module] est initialisé juste avant d'entrer en vue. */
    var moduleEls = document.querySelectorAll("[data-module]");
    moduleEls.forEach(function (el) {
      var name = el.getAttribute("data-module");
      var init = registry[name];
      if (!init) return;
      CO.onView(el, function (target) { init(target); },
        { rootMargin: "300px 0px 300px 0px", threshold: 0 });
    });

    /* Le canvas de signature (pied de page) n'est pas un [data-module]. */
    var signature = document.querySelector("[data-signature]");
    if (signature && registry.signature) {
      CO.onView(signature.parentElement || signature, function () {
        registry.signature(signature);
      }, { rootMargin: "200px 0px 200px 0px", threshold: 0 });
    }
  });
})();
