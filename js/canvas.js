/* =============================================================================
   ClickOn · canvas.js  —  M7 « Signature génératif »
   -----------------------------------------------------------------------------
   Texture de fond générative dans le pied de page. RESTE noir/gris sur blanc :
   elle ne trahit pas la coquille de galerie — c'est la « signature » ClickOn.
   Champ de flux (flow field) léger : fines lignes d'encre qui dérivent.
   Performant : DPR plafonné, nombre de particules borné, pause hors-écran et
   quand l'onglet est masqué. Désactivé proprement en prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  CO.register("signature", function (rootCanvas) {
    var canvas = rootCanvas.matches("[data-signature]") ? rootCanvas : rootCanvas.querySelector("[data-signature]");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var parent = canvas.parentElement;
    var reduced = CO.prefersReducedMotion();

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, particles = [], running = false, rafId = null, t = 0;

    function resize() {
      var rect = parent.getBoundingClientRect();
      W = Math.max(1, Math.floor(rect.width));
      H = Math.max(1, Math.floor(rect.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    /* Champ d'angles pseudo-aléatoire (combinaison de sinus → pas de lib). */
    function field(x, y) {
      return Math.sin(x * 0.0021 + t) * Math.cos(y * 0.0019 - t * 0.7) * Math.PI * 1.8;
    }

    function seed() {
      var area = W * H;
      var count = Math.min(140, Math.max(28, Math.round(area / 14000)));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          life: Math.random() * 200
        });
      }
    }

    function step() {
      /* fondu vers le blanc papier → laisse de fines traînées */
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(10,10,10,0.055)";
      ctx.beginPath();
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = field(p.x, p.y);
        var nx = p.x + Math.cos(a) * 1.4;
        var ny = p.y + Math.sin(a) * 1.4;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        p.x = nx; p.y = ny; p.life--;
        /* réensemencement aux bords ou en fin de vie */
        if (p.life < 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
          p.x = Math.random() * W; p.y = Math.random() * H; p.life = 120 + Math.random() * 160;
        }
      }
      ctx.stroke();
      t += 0.0016;
    }

    function loop() {
      if (!running) return;
      step();
      rafId = window.requestAnimationFrame(loop);
    }
    function start() { if (!running && !reduced) { running = true; loop(); } }
    function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

    resize();

    if (reduced) {
      /* Mouvement réduit : un seul rendu statique discret. */
      for (var k = 0; k < 60; k++) step();
      return;
    }

    /* Pause quand l'onglet est masqué (batterie). */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    /* Ne tourne que lorsque le pied de page est à l'écran. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.02 }).observe(parent);
    } else {
      start();
    }

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { resize(); }).observe(parent);
    } else {
      window.addEventListener("resize", resize);
    }
  });
})();
