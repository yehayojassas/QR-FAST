import "dotenv/config";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist");

const app = express();
app.use(express.json());

// --- Base de données (Supabase Postgres) ---
// Toutes les commandes/statuts/appels/avis sont persistés ici : ils survivent
// aux redémarrages et à la mise en veille de Render (contrairement à un
// stockage en mémoire).
const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquante (voir .env.example).");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const toOrder = (row) => ({
  id: row.id,
  table: row.table,
  items: row.items,
  subtotal: Number(row.subtotal),
  tip: Number(row.tip),
  total: Number(row.total),
  status: row.status,
  createdAt: new Date(row.created_at).getTime(),
});
const toReview = (row) => ({
  id: row.id,
  table: row.table,
  rating: row.rating,
  comment: row.comment || "",
  createdAt: new Date(row.created_at).getTime(),
});
const toHelpCall = (row) => ({
  table: row.table,
  createdAt: new Date(row.created_at).getTime(),
});

// --- Codes PIN de l'équipe (deux rôles) ---
// STAFF_PIN : accepter/refuser une commande, changer le statut d'une table.
// OWNER_PIN : tout ce que fait STAFF_PIN + les actions réservées au
// propriétaire (ex: consulter les avis clients). Si OWNER_PIN n'est pas
// défini, ces actions retombent sur STAFF_PIN (pas de distinction de rôle).
// Si aucun des deux n'est défini (dev local), tout reste ouvert.
const STAFF_PIN = process.env.STAFF_PIN || "";
const OWNER_PIN = process.env.OWNER_PIN || "";
if (!STAFF_PIN && !OWNER_PIN) {
  console.warn("[staff-auth] Aucun PIN défini : les actions serveur sont ouvertes sans protection.");
}
function requireStaffPin(req, res, next) {
  const validPins = [STAFF_PIN, OWNER_PIN].filter(Boolean);
  if (!validPins.length) return next();
  if (validPins.includes(req.get("x-staff-pin"))) return next();
  return res.status(401).json({ error: "unauthorized" });
}
function requireOwnerPin(req, res, next) {
  if (!OWNER_PIN) return requireStaffPin(req, res, next);
  if (req.get("x-staff-pin") === OWNER_PIN) return next();
  return res.status(401).json({ error: "unauthorized" });
}

// CORS : autorise la page serveurs (hébergée sur une autre adresse) à
// communiquer avec le cerveau des commandes.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Staff-Pin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

const subscribers = new Set();
const VALID_STATUSES = new Set(["free", "occupied", "disabled"]);

function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    res.write(data);
  }
}

// --- Flux temps réel (Server-Sent Events) ---
// Utilisé par la page serveurs (toutes les commandes) ET par le client
// (qui filtre pour suivre sa propre commande).
app.get("/api/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  try {
    const [orders, statuses, helpCalls] = await Promise.all([
      pool.query('select * from orders order by created_at asc'),
      pool.query('select * from table_statuses'),
      pool.query('select * from help_calls'),
    ]);
    res.write(`data: ${JSON.stringify({
      type: "snapshot",
      orders: orders.rows.map(toOrder),
      statuses: Object.fromEntries(statuses.rows.map((row) => [row.table, row.status])),
      helpCalls: helpCalls.rows.map(toHelpCall),
    })}\n\n`);
  } catch (err) {
    console.error("[stream] snapshot error:", err.message);
  }
  subscribers.add(res);

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    subscribers.delete(res);
  });
});

// --- Connexion de l'équipe (vérifie le code PIN et renvoie le rôle associé) ---
app.post("/api/staff/login", (req, res) => {
  const { pin } = req.body || {};
  if (!STAFF_PIN && !OWNER_PIN) return res.json({ ok: true, role: "owner" });
  if (OWNER_PIN && pin === OWNER_PIN) return res.json({ ok: true, role: "owner" });
  if (STAFF_PIN && pin === STAFF_PIN) return res.json({ ok: true, role: "staff" });
  return res.status(401).json({ ok: false });
});

// Anti-spam : une table qui rafraîchit/renvoie en boucle ne peut pas noyer la
// cuisine sous de fausses commandes. Limité par table (et par IP en secours),
// pas par IP seule, car tout le Wi-Fi du restaurant partage souvent la même IP.
const orderLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.table ? `table:${req.body.table}` : ipKeyGenerator(req.ip)),
  message: { error: "too_many_requests" },
});

// --- Le client passe une commande ---
app.post("/api/orders", orderLimiter, async (req, res) => {
  const { table, items, total, subtotal, tip } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Commande vide" });
  }
  const tableId = String(table || "?");
  try {
    // Sécurité : une table désactivée ne peut pas envoyer de commande.
    const statusRes = await pool.query('select status from table_statuses where "table" = $1', [tableId]);
    if (statusRes.rows[0]?.status === "disabled") {
      return res.status(403).json({ error: "table_disabled" });
    }
    const cleanItems = items.map((item) => ({
      name: String(item.name || ""),
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      size: item.size ? String(item.size) : "",
    }));
    const insertRes = await pool.query(
      `insert into orders ("table", items, subtotal, tip, total, status)
       values ($1, $2, $3, $4, $5, 'pending') returning *`,
      [tableId, JSON.stringify(cleanItems), Number(subtotal) || Number(total) || 0, Number(tip) || 0, Number(total) || 0],
    );
    const order = toOrder(insertRes.rows[0]);
    broadcast({ type: "order", order });
    return res.json({ id: order.id, order });
  } catch (err) {
    console.error("[orders] insert error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- "Appeler un serveur" ---
// Une table ne peut relancer qu'une fois toutes les 30s (évite le spam d'un
// client qui appuie plusieurs fois par impatience).
const helpLimiter = rateLimit({
  windowMs: 30 * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.table ? `table:${req.body.table}` : ipKeyGenerator(req.ip)),
  message: { error: "too_many_requests" },
});
app.post("/api/help", helpLimiter, async (req, res) => {
  const table = String(req.body?.table || "?");
  try {
    const result = await pool.query(
      `insert into help_calls ("table", created_at) values ($1, now())
       on conflict ("table") do update set created_at = now() returning *`,
      [table],
    );
    broadcast({ type: "help", call: toHelpCall(result.rows[0]) });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[help] insert error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
});
// Le serveur marque l'appel comme traité (protégé, comme les autres actions équipe).
app.post("/api/help/:table/resolve", requireStaffPin, async (req, res) => {
  const table = String(req.params.table);
  try {
    await pool.query('delete from help_calls where "table" = $1', [table]);
    broadcast({ type: "helpResolved", table });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[help] resolve error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- Avis clients (privés) ---
// Note rapide envoyée après un repas servi. Jamais publiée : réservée à
// l'équipe, consultable uniquement avec le code PIN.
app.post("/api/reviews", async (req, res) => {
  const { table, rating, comment } = req.body || {};
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: "Note invalide" });
  }
  try {
    const result = await pool.query(
      `insert into reviews ("table", rating, comment) values ($1, $2, $3) returning *`,
      [String(table || "?"), score, comment ? String(comment).slice(0, 500) : ""],
    );
    const review = toReview(result.rows[0]);
    broadcast({ type: "review", review });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[reviews] insert error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
});
app.get("/api/reviews", requireOwnerPin, async (_req, res) => {
  const result = await pool.query('select * from reviews order by created_at desc limit 50');
  return res.json(result.rows.map(toReview));
});

// --- Le serveur accepte ou refuse ---
async function updateStatus(req, res, status) {
  try {
    const result = await pool.query(
      'update orders set status = $1 where id = $2 returning *',
      [status, Number(req.params.id)],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Commande introuvable" });
    const order = toOrder(result.rows[0]);
    broadcast({ type: "order", order });
    return res.json({ order });
  } catch (err) {
    console.error("[orders] update error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
}
app.post("/api/orders/:id/accept", requireStaffPin, (req, res) => updateStatus(req, res, "accepted"));
app.post("/api/orders/:id/reject", requireStaffPin, (req, res) => updateStatus(req, res, "rejected"));

// Liste des commandes (chargement initial / secours).
app.get("/api/orders", async (_req, res) => {
  const result = await pool.query('select * from orders order by created_at asc');
  return res.json(result.rows.map(toOrder));
});

// --- Statuts des tables ---
// Lecture (page client au chargement / secours).
app.get("/api/tables/statuses", async (_req, res) => {
  const result = await pool.query('select * from table_statuses');
  return res.json(Object.fromEntries(result.rows.map((row) => [row.table, row.status])));
});

// Le serveur change le statut d'une table.
app.post("/api/tables/:table/status", requireStaffPin, async (req, res) => {
  const table = String(req.params.table);
  const { status } = req.body || {};
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }
  try {
    if (status === "free") {
      await pool.query('delete from table_statuses where "table" = $1', [table]);
    } else {
      await pool.query(
        `insert into table_statuses ("table", status) values ($1, $2)
         on conflict ("table") do update set status = $2`,
        [table, status],
      );
    }
    broadcast({ type: "tableStatus", table, status });

    if (status === "free") {
      // Libérer une table efface aussi un éventuel appel serveur resté sans réponse.
      const helpDeleted = await pool.query('delete from help_calls where "table" = $1 returning "table"', [table]);
      if (helpDeleted.rows.length) broadcast({ type: "helpResolved", table });

      // Remettre une table en "Libre" = les clients sont partis : on efface les
      // commandes acceptées (servies) attachées à cette table.
      const cleared = await pool.query(
        `delete from orders where "table" = $1 and status = 'accepted' returning id`,
        [table],
      );
      if (cleared.rows.length) {
        broadcast({ type: "ordersCleared", table, ids: cleared.rows.map((row) => row.id) });
      }
    }
    return res.json({ table, status });
  } catch (err) {
    console.error("[tables] status error:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
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
