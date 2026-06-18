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
  res.write(`data: ${JSON.stringify({ type: "snapshot", orders: [...orders.values()] })}\n\n`);
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

// --- Pages ---
// Ce service (clickone-menu) sert le MENU CLIENT à sa racine.
app.get("/", (_req, res) => res.sendFile(join(DIST, "menu.html")));
app.get("/staff", (_req, res) => res.sendFile(join(DIST, "staff.html")));
app.use(express.static(DIST, { index: false }));
// Toute autre route renvoie le menu client.
app.get(/.*/, (_req, res) => res.sendFile(join(DIST, "menu.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ClickOne en écoute sur le port ${port}`));
