# ClickOn — « Le site qui se vend lui-même »

Démonstration commerciale vivante pour **ClickOn**, studio web dans le canton de Vaud
(Suisse romande). Ce n'est pas un portfolio : c'est un argumentaire interactif qui fait
*ressentir* l'écart entre « un site web » et « une présence numérique vivante ».

> **Fil rouge :** Votre site ne devrait pas être une brochure. Il devrait travailler pour vous.

---

## Parti pris visuel

La **coquille** (en-tête, navigation, liaisons, pied de page) est une **galerie neutre** :
noir sur blanc, beaucoup d'espace, aucune couleur d'accent. Les **modules**, eux, explosent
de couleur et de mouvement. Le contraste entre la sobriété du cadre et la richesse des
œuvres *est* l'argument visuel central.

## Démarrer

Aucun build, aucune dépendance, aucun backend.

```bash
# Option 1 : ouvrir directement
#   double-cliquez index.html

# Option 2 : petit serveur local (recommandé)
python -m http.server 8000      # puis http://localhost:8000
# ou
npx serve .
```

**Hébergement** : déposez le dossier tel quel sur Netlify, Vercel ou GitHub Pages.

## Structure

```
index.html              Page unique, sections sémantiques + cartels
css/
  tokens.css            Design system : la CHARTE neutre (couleurs, typo, easings)
  base.css              La COQUILLE galerie (reset, nav, cartels, footer)
  modules.css           Là où la COULEUR explose — une palette scopée par module
js/
  utils.js              Socle partagé (maths, observers, registre de modules)
  main.js               Orchestration (scrollspy, reveals, init paresseuse)
  hero.js               M1 · scroll-driven + lever de rideau
  living.js             M2 · site vivant ★ (scrubber temporel, ouvert/fermé, saison)
  order.js              M3b · commande en ligne (panier + total en direct)
  kinetic.js            M5 · typo cinétique (variable fonts)
  map.js                M6 · carte Vaud custom (SVG)
  compare.js            M7 · avant/après ★ (clip-path drag — exemple réel Mov'It)
  canvas.js             signature génératif (noir/gris sur blanc)
assets/
  movit/                captures avant/après (vitrine Mov'It)
```

## Les modules (technique → argument)

| # | Module | Technique | Ce que ça apporte |
|---|--------|-----------|-------------------|
| 01 | Hero scroll-driven | Sticky pinning, parallaxe, masques, compte à rebours | Capter en 3 secondes |
| 02 | Site vivant ★ | Theming jour/nuit, statut ouvert/fermé, saison — calculés en JS | Un service vivant, pas un livrable figé |
| 03 | Grille bento | CSS Grid asymétrique, hover riches, halo au curseur | Tout d'un coup d'œil |
| 04 | Adapté à vos besoins | Commande en ligne data-driven : choix des tailles, panier, total en direct | Une fonctionnalité sur-mesure (commande, réservation…) |
| 05 | Typo cinétique | Variable fonts, mot rotatif masqué, marquees au scroll | Une marque, pas un template |
| 06 | Carte Vaud | SVG custom interactif (souris + clavier), onde de portée | SEO local & proximité |
| 07 | Avant / Après ★ | Comparateur clip-path (souris/tactile/clavier), 2 captures réelles (Mov'It) | L'écart, sans un mot |
| — | Signature | Flow field canvas, borné & pausable | Texture premium, maîtrise technique |

## Réutiliser un bloc chez un vrai client

Chaque module est **autonome et extractible** :

1. Copiez le `<section class="module ...">` correspondant dans `index.html`.
2. Copiez son bloc commenté dans `css/modules.css` (chaque module déclare ses
   propres variables `--m-*` / `--lv-*` / etc. → aucune fuite de style).
3. Copiez son fichier `js/<module>.js`. Il s'enregistre via
   `ClickOn.register("nom", initFn)` et n'a besoin que de `utils.js`.

Pour **adapter le site vivant** à un commerce : tout est en haut de `living.js`
(`SCHEDULE`, `DAYS`, palettes `STOPS`, textes de bannière). Changez les horaires,
c'est prêt.

## Accessibilité & performance

- Navigation clavier complète (carte, comparateur, nav) ; focus visibles.
- `prefers-reduced-motion` respecté partout (animations neutralisées proprement).
- Contrastes pensés AA dans la coquille noir/blanc.
- Animations en `transform` / `opacity` (GPU) ; `requestAnimationFrame` throttlé ;
  modules initialisés **à l'approche du viewport** ; canvas en pause hors-écran.

---

© ClickOn — Studio web, canton de Vaud. Démo HTML · CSS · JS, sans backend.
