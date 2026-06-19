/* =============================================================================
   ClickOn · order.js  —  M3b « Adapté à vos besoins et services »
   -----------------------------------------------------------------------------
   Exemple de commande en ligne : menu data-driven, choix des tailles, panier
   et total calculés en direct — 100 % côté client, zéro backend.
   Bloc autonome : changez MENU en haut → réutilisable pour n'importe quel commerce.
   ========================================================================== */
(function () {
  "use strict";
  var CO = window.ClickOn;

  /* Tailles (prix en CHF). */
  var STD = [{ label: "30", price: 19 }, { label: "36", price: 32 }, { label: "45", price: 40 }];
  var MARG = [{ label: "30", price: 16 }, { label: "36", price: 28 }, { label: "45", price: 40 }];

  /* Uniquement des plats (pizzas) — commandables. */
  var MENU = [
    { name: "Pizza Flash", desc: "Sauce tomate, mozzarella, jambon, champignons frais — la signature", tag: "⚡ Signature", sizes: STD },
    { name: "Chorizo", desc: "Sauce tomate, mozzarella, salami piquant", tag: "Bestseller", sizes: STD },
    { name: "Margherita", desc: "Sauce tomate, mozzarella, origan", tag: null, sizes: MARG },
    { name: "Quatre Fromages", desc: "Mozzarella, gorgonzola, parmesan, chèvre frais", tag: null, sizes: STD },
    { name: "Arrabiata", desc: "Sauce pimentée, jambon, champignons, olives", tag: "🔥 Hot", sizes: STD },
    { name: "Champignon", desc: "Sauce tomate, mozzarella, champignons frais", tag: null, sizes: STD },
    { name: "Hawaii", desc: "Sauce tomate, mozzarella, jambon, ananas caramélisé", tag: null, sizes: STD }
  ];

  function chf(n) { return "CHF " + n.toFixed(2); }

  CO.register("commande", function (root) {
    var grid = root.querySelector("[data-menu-grid]");
    var listEl = root.querySelector("[data-cart-list]");
    var countEl = root.querySelector("[data-cart-count]");
    var totalEl = root.querySelector("[data-cart-total]");
    var ctaEl = root.querySelector("[data-cart-cta]");
    var footEl = root.querySelector("[data-cart-foot]");
    if (!grid || !listEl) return;

    var cart = [];          // { key, name, size, price, qty }
    var selectedSize = {};  // name -> index de la taille choisie

    /* ---- Rendu du menu (cartes texte, sans photo) ----------------------- */
    MENU.forEach(function (item) {
      selectedSize[item.name] = 0;

      var card = document.createElement("article");
      card.className = "dish-card";

      var sizesHtml = '<div class="dish-card__sizes" role="group" aria-label="Taille">' +
        item.sizes.map(function (s, si) {
          return '<button class="size-pill" type="button" data-size="' + si + '" aria-pressed="' + (si === 0) + '">' + s.label + " cm</button>";
        }).join("") + "</div>";

      card.innerHTML =
        '<div class="dish-card__body">' +
          '<div class="dish-card__top">' +
            '<h3 class="dish-card__name">' + item.name + "</h3>" +
            (item.tag ? '<span class="dish-card__tag">' + item.tag + "</span>" : "") +
          "</div>" +
          '<p class="dish-card__desc">' + item.desc + "</p>" +
          sizesHtml +
          '<div class="dish-card__foot">' +
            '<span class="dish-card__price" data-price>' + item.sizes[0].price.toFixed(0) + "<small>.–</small></span>" +
            '<button class="add-btn" type="button" data-add aria-label="Ajouter ' + item.name + ' au panier">Ajouter +</button>' +
          "</div>" +
        "</div>";

      grid.appendChild(card);

      var priceEl = card.querySelector("[data-price]");
      var pills = card.querySelectorAll(".size-pill");

      pills.forEach(function (pill) {
        pill.addEventListener("click", function () {
          var idx = parseInt(pill.getAttribute("data-size"), 10);
          selectedSize[item.name] = idx;
          pills.forEach(function (p) { p.setAttribute("aria-pressed", "false"); });
          pill.setAttribute("aria-pressed", "true");
          priceEl.innerHTML = item.sizes[idx].price.toFixed(0) + "<small>.–</small>";
        });
      });

      card.querySelector("[data-add]").addEventListener("click", function () { addToCart(item); });
    });

    /* ---- Panier ---------------------------------------------------------- */
    function addToCart(item) {
      var idx = selectedSize[item.name];
      var sizeLabel = item.sizes[idx].label + " cm";
      var price = item.sizes[idx].price;
      var key = item.name + "|" + sizeLabel;
      var line = cart.filter(function (l) { return l.key === key; })[0];
      if (line) { line.qty++; }
      else { cart.push({ key: key, name: item.name, size: sizeLabel, price: price, qty: 1 }); }
      clearDone();
      render();
    }

    function changeQty(key, delta) {
      var line = cart.filter(function (l) { return l.key === key; })[0];
      if (!line) return;
      line.qty += delta;
      if (line.qty <= 0) cart = cart.filter(function (l) { return l.key !== key; });
      clearDone();
      render();
    }

    function clearDone() {
      var done = footEl && footEl.querySelector(".cart__done");
      if (done) done.remove();
    }

    function render() {
      var count = cart.reduce(function (n, l) { return n + l.qty; }, 0);
      var total = cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0);

      if (countEl) countEl.textContent = count;
      if (totalEl) totalEl.textContent = total.toFixed(2);
      if (ctaEl) ctaEl.disabled = count === 0;

      if (!cart.length) {
        listEl.innerHTML = '<p class="cart__empty">Votre panier est vide — composez votre commande 🍕</p>';
        return;
      }

      listEl.innerHTML = "";
      cart.forEach(function (l) {
        var row = document.createElement("div");
        row.className = "cart__line";
        row.innerHTML =
          '<div class="cart__line-name">' + l.name +
            (l.size ? "<span>" + l.size + "</span>" : "") + "</div>" +
          '<div class="qty">' +
            '<button type="button" data-minus aria-label="Retirer un">−</button>' +
            "<span>" + l.qty + "</span>" +
            '<button type="button" data-plus aria-label="Ajouter un">+</button>' +
          "</div>" +
          '<div class="cart__line-price">' + chf(l.price * l.qty) + "</div>";
        row.querySelector("[data-minus]").addEventListener("click", function () { changeQty(l.key, -1); });
        row.querySelector("[data-plus]").addEventListener("click", function () { changeQty(l.key, +1); });
        listEl.appendChild(row);
      });
    }

    if (ctaEl) {
      ctaEl.addEventListener("click", function () {
        if (!cart.length) return;
        var total = cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
        var count = cart.reduce(function (n, l) { return n + l.qty; }, 0);
        clearDone();
        var done = document.createElement("div");
        done.className = "cart__done";
        done.innerHTML = "✅ Commande prête : <b>" + count + " article" + (count > 1 ? "s" : "") +
          " · " + chf(total) + "</b>.<br>En vrai, elle filerait directement en cuisine (ou sur WhatsApp). " +
          "Pendant ce temps, vous cuisinez — pas au téléphone.";
        footEl.appendChild(done);
        cart = [];
        render();
      });
    }

    render();
  });
})();
