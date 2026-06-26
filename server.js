import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist");

const app = express();
app.use(express.json());

// CORS : autorise la page serveurs (hébergée sur une autre adresse) à
// communiquer avec le cerveau des commandes.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

// --- Stockage des commandes en mémoire ---
// Suffisant pour le service en direct. Les commandes sont remises à zéro
// si le serveur redémarre (mise en veille Render après inactivité).
let nextId = 1;
const orders = new Map();
const subscribers = new Set();

// Statuts des tables pilotés par les serveurs : "free" | "occupied" | "disabled".
// Une table absente de la map est considérée "free". Une table "disabled"
// refuse toute nouvelle commande (contrôle de sécurité côté serveur).
const tableStatuses = new Map();
const VALID_STATUSES = new Set(["free", "occupied", "disabled"]);
const statusesObject = () => Object.fromEntries(tableStatuses);

function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    res.write(data);
  }
}

// --- Flux temps réel (Server-Sent Events) ---
// Utilisé par la page serveurs (toutes les commandes) ET par le client
// (qui filtre pour suivre sa propre commande).
app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  // Envoie l'état actuel à la connexion (les commandes déjà en cours).
  res.write(`data: ${JSON.stringify({ type: "snapshot", orders: [...orders.values()], statuses: statusesObject() })}\n\n`);
  subscribers.add(res);

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    subscribers.delete(res);
  });
});

// --- Le client passe une commande ---
app.post("/api/orders", (req, res) => {
  const { table, items, total } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Commande vide" });
  }
  // Sécurité : une table désactivée ne peut pas envoyer de commande.
  if (tableStatuses.get(String(table)) === "disabled") {
    return res.status(403).json({ error: "table_disabled" });
  }
  const order = {
    id: nextId++,
    table: String(table || "?"),
    items: items.map((item) => ({
      name: String(item.name || ""),
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      size: item.size ? String(item.size) : "",
    })),
    total: Number(total) || 0,
    status: "pending",
    createdAt: Date.now(),
  };
  orders.set(order.id, order);
  broadcast({ type: "order", order });
  return res.json({ id: order.id, order });
});

// --- Le serveur accepte ou refuse ---
function updateStatus(req, res, status) {
  const order = orders.get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Commande introuvable" });
  order.status = status;
  broadcast({ type: "order", order });
  return res.json({ order });
}
app.post("/api/orders/:id/accept", (req, res) => updateStatus(req, res, "accepted"));
app.post("/api/orders/:id/reject", (req, res) => updateStatus(req, res, "rejected"));

// Liste des commandes (chargement initial / secours).
app.get("/api/orders", (_req, res) => res.json([...orders.values()]));

// --- Statuts des tables ---
// Lecture (page client au chargement / secours).
app.get("/api/tables/statuses", (_req, res) => res.json(statusesObject()));

// Le serveur change le statut d'une table.
app.post("/api/tables/:table/status", (req, res) => {
  const table = String(req.params.table);
  const { status } = req.body || {};
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }
  if (status === "free") tableStatuses.delete(table);
  else tableStatuses.set(table, status);
  broadcast({ type: "tableStatus", table, status });

  // Remettre une table en "Libre" = les clients sont partis : on efface les
  // commandes acceptées (servies) attachées à cette table.
  if (status === "free") {
    const cleared = [];
    for (const [id, order] of orders) {
      if (String(order.table) === table && order.status === "accepted") {
        orders.delete(id);
        cleared.push(id);
      }
    }
    if (cleared.length) broadcast({ type: "ordersCleared", table, ids: cleared });
  }
  return res.json({ table, status });
});

// --- Pages ---
// Ce service (clickone-menu) sert le MENU CLIENT à sa racine.
app.get("/", (_req, res) => res.sendFile(join(DIST, "menu.html")));
app.get("/staff", (_req, res) => res.sendFile(join(DIST, "staff.html")));
app.use(express.static(DIST, { index: false }));
// Toute autre route renvoie le menu client.
app.get(/.*/, (_req, res) => res.sendFile(join(DIST, "menu.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ClickOne en écoute sur le port ${port}`));

// --- Auto-ping anti-veille Render ---
// Render endort le service après ~15 min sans requête entrante. On se ping
// soi-même toutes les 7 min pour rester éveillé tant que le process tourne.
const KEEP_ALIVE_URL =
  process.env.KEEP_ALIVE_URL || "https://clickone-menu.onrender.com/";
if (process.env.DISABLE_KEEP_ALIVE !== "1") {
  setInterval(() => {
    fetch(KEEP_ALIVE_URL)
      .then((r) => console.log(`[keep-alive] ${r.status} ${KEEP_ALIVE_URL}`))
      .catch((err) => console.log(`[keep-alive] erreur: ${err.message}`));
  }, 7 * 60 * 1000);
}
