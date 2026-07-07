// Service worker de l'espace serveurs (PWA "installable" sur tablette).
// Stratégie volontairement simple :
//  - /api/* et le flux temps réel (SSE) : jamais mis en cache, toujours réseau direct.
//    Les commandes doivent rester en temps réel, jamais servies depuis un cache.
//  - Tout le reste (app shell : JS/CSS/HTML/icônes) : cache-first avec mise à
//    jour en arrière-plan, pour un démarrage instantané et une résistance aux
//    coupures réseau ponctuelles du Wi-Fi de l'établissement.
const CACHE_NAME = "clickone-staff-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return; // laisse passer, non intercepté

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
