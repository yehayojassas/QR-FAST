/* =============================================================================
   ClickOn · living.js  —  M2 ★ « Un site qui change tout seul »
   -----------------------------------------------------------------------------
   Le cœur du modèle ClickOn. Tout est calculé côté client, sans backend :
     · theming jour/nuit interpolé en continu (couleurs, astre, étoiles) ;
     · statut ouvert/fermé déduit d'un horaire métier vs l'heure ;
     · bannière de saison / nuit ;
     · un SCRUBBER : le visiteur « voyage dans le temps » et voit le site réagir.
   Bloc autonome. Réglages métier en haut → réutilisable pour n'importe quel client.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  /* --- Réglages métier (à adapter par client) ---------------------------- */
  var DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  /* Horaires en minutes depuis minuit. getDay() : 0 = dimanche … 6 = samedi. */
  var SCHEDULE = {
    0: [],                              // dimanche : fermé
    1: [[480, 720], [810, 1080]],      // lun  08:00–12:00 · 13:30–18:00
    2: [[480, 720], [810, 1080]],
    3: [[480, 720], [810, 1080]],
    4: [[480, 720], [810, 1080]],
    5: [[480, 720], [810, 1080]],
    6: [[480, 720]]                    // sam 08:00–12:00
  };

  /* Palettes-clés sur 24 h (couleurs interpolées entre deux bornes). */
  var STOPS = [
    { h: 0,  bg: "#0b1030", bg2: "#161d4a", fg: "#eef1ff", muted: "#9aa2d6", accent: "#cfd8ff", glow: "#2b3a8f" },
    { h: 5,  bg: "#1a1f47", bg2: "#4a3a6e", fg: "#f0eefc", muted: "#b3a9d0", accent: "#ff9e6b", glow: "#6a4a9f" },
    { h: 7,  bg: "#f3cba6", bg2: "#e8966e", fg: "#2a1a12", muted: "#6a4a38", accent: "#ffb24d", glow: "#ffd08a" },
    { h: 10, bg: "#cfe6ff", bg2: "#a9ccf0", fg: "#12233f", muted: "#43587a", accent: "#ffd24a", glow: "#ffe8a0" },
    { h: 13, bg: "#dff1ff", bg2: "#bfe2ff", fg: "#0e2033", muted: "#3c5470", accent: "#ffe14a", glow: "#ffeab0" },
    { h: 17, bg: "#ecd6b2", bg2: "#cf8a58", fg: "#2a1c12", muted: "#5a4630", accent: "#ffb84a", glow: "#ffd0a0" },
    { h: 19, bg: "#3a2a55", bg2: "#b5573f", fg: "#fdeede", muted: "#d6ac92", accent: "#ff8a4d", glow: "#ff7b54" },
    { h: 21, bg: "#14183a", bg2: "#20264f", fg: "#eef0ff", muted: "#aab0d8", accent: "#cdd6ff", glow: "#4361ee" },
    { h: 24, bg: "#0b1030", bg2: "#161d4a", fg: "#eef1ff", muted: "#9aa2d6", accent: "#cfd8ff", glow: "#2b3a8f" }
  ];
  var COLOR_KEYS = ["bg", "bg2", "fg", "muted", "accent", "glow"];

  /* --- Helpers ----------------------------------------------------------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtClock(min) { return pad(Math.floor(min / 60)) + ":" + pad(min % 60); }
  function fmtHour(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + " h" + (m ? " " + pad(m) : " 00");
  }

  /* Interpole la palette pour une heure décimale donnée. */
  function paletteFor(hour) {
    var i = 0;
    while (i < STOPS.length - 1 && !(hour >= STOPS[i].h && hour < STOPS[i + 1].h)) i++;
    var a = STOPS[i], b = STOPS[i + 1] || STOPS[i];
    var t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h);
    var out = {};
    COLOR_KEYS.forEach(function (k) { out[k] = CO.mixHex(a[k], b[k], t); });
    return out;
  }

  /* Élévation de l'astre [-1 (bas) … 1 (haut)] et dérivés. */
  function celestial(hour) {
    var elevation = -Math.cos((hour / 24) * Math.PI * 2); // -1 à minuit, +1 à midi
    var orbX = hour / 24;                                  // sweep gauche→droite
    var orbY = 0.85 - ((elevation + 1) / 2) * 0.72;        // haut à midi, bas la nuit
    var stars = CO.clamp(CO.mapRange(elevation, 0.12, -0.18, 0, 1), 0, 1);
    return { elevation: elevation, orbX: orbX, orbY: orbY, stars: stars };
  }

  /* Statut ouvert/fermé pour un jour + une minute. */
  function statusFor(day, minutes) {
    var today = SCHEDULE[day] || [];
    for (var i = 0; i < today.length; i++) {
      if (minutes >= today[i][0] && minutes < today[i][1]) {
        return { open: true, closeAt: today[i][1] };
      }
    }
    /* Prochaine ouverture : aujourd'hui plus tard, sinon jours suivants. */
    for (var j = 0; j < today.length; j++) {
      if (today[j][0] > minutes) return { open: false, nextDay: day, nextMin: today[j][0], offset: 0 };
    }
    for (var d = 1; d <= 7; d++) {
      var nd = (day + d) % 7, sched = SCHEDULE[nd];
      if (sched && sched.length) return { open: false, nextDay: nd, nextMin: sched[0][0], offset: d };
    }
    return { open: false, nextDay: day, nextMin: 480, offset: 7 };
  }

  function greetingFor(hour) {
    if (hour >= 5 && hour < 11) return "Bonjour ! On démarre la journée.";
    if (hour >= 11 && hour < 14) return "Midi sur le Léman — on reste joignables.";
    if (hour >= 14 && hour < 18) return "Bel après-midi. Passez quand vous voulez.";
    if (hour >= 18 && hour < 22) return "Bonsoir. On range les clés — le site, lui, veille.";
    return "Il est tard. Le garage dort… le site, non.";
  }

  function bannerFor(hour, month) {
    if (hour >= 22 || hour < 6) {
      return { emoji: "🌙", text: "La nuit, le site prend le relais : laissez votre demande, on rappelle au matin." };
    }
    if (month === 11 || month === 0 || month === 1) {
      return { emoji: "❄️", text: "Premières gelées — montez vos pneus neige, créneaux ouverts cette semaine." };
    }
    if (month >= 2 && month <= 4) {
      return { emoji: "🌸", text: "Le printemps revient — c'est l'heure du grand service de saison." };
    }
    if (month >= 5 && month <= 7) {
      return { emoji: "☀️", text: "Avant les vacances : check-up « départ serein » offert ce mois-ci." };
    }
    return { emoji: "🍂", text: "L'automne s'installe — vérifiez freins et batterie avant l'hiver." };
  }

  /* --- Init module ------------------------------------------------------- */
  CO.register("living", function (root) {
    var el = {
      frame: root.querySelector(".living__frame"),
      greet: root.querySelector("[data-lv-greet]"),
      status: root.querySelector("[data-lv-status]"),
      statusText: root.querySelector("[data-lv-status-text]"),
      statusSub: root.querySelector("[data-lv-status-sub]"),
      bannerEmoji: root.querySelector("[data-lv-banner-emoji]"),
      bannerText: root.querySelector("[data-lv-banner-text]"),
      clock: root.querySelector("[data-lv-clock]"),
      day: root.querySelector("[data-lv-day]"),
      range: root.querySelector("[data-lv-range]"),
      live: root.querySelector("[data-lv-live]")
    };

    var realDay = new Date().getDay();
    var month = new Date().getMonth();
    var liveMode = true;
    var pollId = null;

    function realMinutes() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

    /* Applique TOUT l'état pour une minute donnée. */
    function render(minutes) {
      var hour = minutes / 60;
      var pal = paletteFor(hour);
      var sky = celestial(hour);
      var isLight = sky.elevation > 0;

      /* Couleurs + ciel (variables CSS sur la racine du module). */
      var s = root.style;
      s.setProperty("--lv-bg", pal.bg);
      s.setProperty("--lv-bg2", pal.bg2);
      s.setProperty("--lv-fg", pal.fg);
      s.setProperty("--lv-muted", pal.muted);
      s.setProperty("--lv-accent", pal.accent);
      s.setProperty("--lv-glow", pal.glow);
      s.setProperty("--orb-x", sky.orbX.toFixed(3));
      s.setProperty("--orb-y", sky.orbY.toFixed(3));
      s.setProperty("--stars", sky.stars.toFixed(3));
      /* cartes/lignes lisibles selon thème clair ou sombre */
      s.setProperty("--lv-card", isLight ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.07)");
      s.setProperty("--lv-line", isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)");

      /* Horloge + jour */
      if (el.clock) el.clock.textContent = fmtClock(minutes);
      if (el.day) el.day.textContent = DAYS[realDay];

      /* Salutation */
      if (el.greet) el.greet.textContent = greetingFor(hour);

      /* Statut ouvert/fermé */
      var st = statusFor(realDay, minutes);
      if (el.status) el.status.setAttribute("data-open", st.open ? "true" : "false");
      if (el.statusText) el.statusText.textContent = st.open ? "Ouvert maintenant" : "Fermé";
      if (el.statusSub) {
        if (st.open) {
          el.statusSub.textContent = "Ferme à " + fmtHour(st.closeAt);
        } else if (st.offset === 0) {
          el.statusSub.textContent = "Ouvre à " + fmtHour(st.nextMin);
        } else if (st.offset === 1) {
          el.statusSub.textContent = "Ouvre demain à " + fmtHour(st.nextMin);
        } else {
          el.statusSub.textContent = "Ouvre " + DAYS[st.nextDay].toLowerCase() + " à " + fmtHour(st.nextMin);
        }
      }

      /* Bannière saison / nuit */
      var b = bannerFor(hour, month);
      if (el.bannerEmoji) el.bannerEmoji.textContent = b.emoji;
      if (el.bannerText) el.bannerText.textContent = b.text;
    }

    function setLive(on) {
      liveMode = on;
      if (el.live) {
        el.live.setAttribute("data-live", on ? "true" : "false");
        el.live.textContent = on ? "● Synchronisé sur l'heure réelle" : "↻ Revenir à l'heure réelle";
      }
      if (on) {
        var m = realMinutes();
        if (el.range) el.range.value = m;
        render(m);
        if (!pollId) pollId = window.setInterval(function () {
          if (!liveMode) return;
          var mm = realMinutes();
          if (el.range) el.range.value = mm;
          render(mm);
        }, 20000);
      }
    }

    /* Interactions */
    if (el.range) {
      el.range.addEventListener("input", function () {
        if (liveMode) setLive(false);
        render(parseInt(el.range.value, 10));
      });
    }
    if (el.live) {
      el.live.addEventListener("click", function () { setLive(true); });
    }

    /* Démarrage : synchronisé sur l'heure réelle. */
    setLive(true);
  });
})();
