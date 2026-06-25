import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BellRinging, CheckCircle, Gear, XCircle } from "@phosphor-icons/react";
import "./styles.css";

const money = (value) => `${Number(value).toFixed(2)} CHF`;
const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
// Plan de salle en 4-2-4 (couloir central). Les tables ne portent plus de carte
// de commande : seulement un badge compteur + un halo léger. Le détail des
// commandes vit dans le panneau latéral "Commandes en attente".
const TABLES = [
  { id: "1", seats: 2, shape: "round", x: 13, y: 16 },
  { id: "2", seats: 4, shape: "square", x: 38, y: 16 },
  { id: "3", seats: 2, shape: "round", x: 62, y: 16 },
  { id: "4", seats: 4, shape: "square", x: 87, y: 16 },
  { id: "5", seats: 4, shape: "square", x: 25, y: 50 },
  { id: "6", seats: 4, shape: "square", x: 75, y: 50 },
  { id: "7", seats: 4, shape: "square", x: 13, y: 84 },
  { id: "8", seats: 2, shape: "round", x: 38, y: 84 },
  { id: "9", seats: 4, shape: "square", x: 62, y: 84 },
  { id: "10", seats: 2, shape: "round", x: 87, y: 84 },
];
const STATUS_LABELS = {
  free: "Libre",
  occupied: "Occupée",
  disabled: "Désactivée",
};
const STATUS_OPTIONS = ["free", "occupied", "disabled"];

// Adresse du "cerveau" des commandes (le service du menu).
// Priorité : ?api=... dans l'URL → mémorisé → injecté au build (Render) → même origine.
function resolveApiBase() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("api");
  if (fromUrl) {
    localStorage.setItem("clickone_api", fromUrl);
  }
  const stored = fromUrl || localStorage.getItem("clickone_api");
  const fromBuild = import.meta.env.VITE_API_BASE;
  let base = stored
    || (fromBuild ? (/^https?:/.test(fromBuild) ? fromBuild : `https://${fromBuild}`) : "")
    || window.location.origin;
  return base.replace(/\/$/, "");
}
const API_BASE = resolveApiBase();

function configureMenuAddress() {
  const current = localStorage.getItem("clickone_api") || "";
  const value = window.prompt(
    "Adresse du menu (le service ClickOne), ex: https://clickone-menu.onrender.com",
    current,
  );
  if (value) {
    localStorage.setItem("clickone_api", value.trim().replace(/\/$/, ""));
    window.location.reload();
  }
}

function StaffApp() {
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  // Placement dynamique du menu de statut pour qu'il reste toujours visible.
  const [popoverPos, setPopoverPos] = useState({ up: false, align: "center" });
  const [highlightedTable, setHighlightedTable] = useState(null);
  // Statuts des tables, source de vérité = backend (synchronisé en temps réel).
  const [statuses, setStatuses] = useState({});
  const audioRef = useRef(null);
  const highlightTimer = useRef(null);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setOrders(message.orders);
        if (message.statuses) setStatuses(message.statuses);
      } else if (message.type === "tableStatus") {
        setStatuses((current) => ({ ...current, [message.table]: message.status }));
      } else if (message.type === "order") {
        setOrders((current) => {
          const isNew = !current.some((o) => o.id === message.order.id);
          if (isNew && message.order.status === "pending") beep();
          const others = current.filter((o) => o.id !== message.order.id);
          return [...others, message.order].sort((a, b) => a.createdAt - b.createdAt);
        });
      }
    };
    return () => source.close();
  }, []);

  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  function beep() {
    try {
      const ctx = audioRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {
      /* le son n'est pas critique */
    }
  }

  // Envoie le nouveau statut au backend (mise à jour optimiste locale + diffusion
  // temps réel à toutes les pages, y compris les clients).
  async function setTableStatus(table, status) {
    setStatuses((current) => ({ ...current, [String(table)]: status }));
    setSelectedTable(null);
    try {
      await fetch(`${API_BASE}/api/tables/${table}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      /* ignoré : le flux temps réel resynchronise l'état */
    }
  }

  async function act(order, action) {
    try {
      await fetch(`${API_BASE}/api/orders/${order.id}/${action}`, { method: "POST" });
      if (action === "accept") setTableStatus(order.table, "occupied");
    } catch {
      /* ignoré : le flux temps réel resynchronise l'état */
    }
  }

  // Ouvre (ou ferme) le menu de statut en calculant son placement pour qu'il
  // ne sorte jamais de l'écran (tables du bas → vers le haut, bords → décalé).
  function toggleStatusMenu(tableId, buttonEl) {
    if (selectedTable === tableId) {
      setSelectedTable(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const isNarrow = window.innerWidth <= 1100;
    // En vue mobile, un tiroir occupe le bas : on ouvre vers le haut plus tôt.
    const up = isNarrow
      ? rect.bottom > window.innerHeight * 0.52
      : rect.bottom + 210 > window.innerHeight;
    let align = "center";
    if (rect.left < 110) align = "left";
    else if (window.innerWidth - rect.right < 110) align = "right";
    setPopoverPos({ up, align });
    setSelectedTable(tableId);
  }

  // Met brièvement une table en évidence sur le plan (clic depuis le panneau).
  function highlightTable(tableId) {
    setSelectedTable(null);
    setHighlightedTable(tableId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedTable(null), 2600);
  }

  const pending = orders.filter((order) => order.status === "pending");
  const acceptedTables = new Set(
    orders.filter((order) => order.status === "accepted").map((order) => String(order.table)),
  );
  const pendingByTable = pending.reduce((acc, order) => {
    const table = String(order.table);
    acc[table] = [...(acc[table] || []), order];
    return acc;
  }, {});

  function getTableStatus(tableId) {
    if (statuses[tableId] === "disabled") return "disabled";
    if (pendingByTable[tableId]?.length) return "occupied";
    return statuses[tableId] || (acceptedTables.has(tableId) ? "occupied" : "free");
  }

  return (
    <div className="staff-view">
      <div className="staff-title">
        <h1>Commandes</h1>
        <div className="staff-title-right">
          <span className={`live-pill ${pending.length ? "ringing" : ""}`}>
            <span />
            {connected ? (pending.length ? `${pending.length} en attente` : "En ligne") : "Connexion…"}
          </span>
          <button className="staff-settings" onClick={configureMenuAddress} aria-label="Configurer l'adresse du menu" title="Configurer l'adresse du menu">
            <Gear size={20} />
          </button>
        </div>
      </div>

      <div className="table-status-legend" aria-label="Légende des tables">
        <span><i className="status-dot free" /> Libre</span>
        <span><i className="status-dot occupied" /> Occupée</span>
        <span><i className="status-dot disabled" /> Désactivée</span>
      </div>

      <div className="staff-layout">
        <main className="dining-room" onClick={() => setSelectedTable(null)}>
          {TABLES.map((table) => {
            const tableOrders = pendingByTable[table.id] || [];
            const status = getTableStatus(table.id);
            const hasOrder = tableOrders.length > 0;
            return (
              <div
                className={`table-zone table-zone-${table.id} ${hasOrder ? "has-order" : ""} ${highlightedTable === table.id ? "is-highlighted" : ""} ${selectedTable === table.id ? "is-active" : ""}`}
                style={{ left: `${table.x}%`, top: `${table.y}%` }}
                key={table.id}
              >
                <button
                  className={`restaurant-table ${table.shape} status-${status} ${selectedTable === table.id ? "is-selected" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleStatusMenu(table.id, event.currentTarget);
                  }}
                  aria-label={`Table ${table.id}, ${STATUS_LABELS[status]}${tableOrders.length ? `, ${tableOrders.length} commande${tableOrders.length > 1 ? "s" : ""} en attente` : ""}`}
                >
                  {hasOrder && (
                    <span className="table-order-count" aria-hidden="true">{tableOrders.length}</span>
                  )}
                  <span className={`table-status-dot ${status}`} />
                  <span className="chairs" aria-hidden="true">
                    {Array.from({ length: table.seats }).map((_, index) => (
                      <span className={`chair chair-${index + 1}`} key={index} />
                    ))}
                  </span>
                  <strong>{table.id}</strong>
                </button>

                {selectedTable === table.id && (
                  <div
                    className={`table-status-popover ${popoverPos.up ? "popover-up" : "popover-down"} popover-${popoverPos.align}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        className={option === status ? "active" : ""}
                        onClick={() => setTableStatus(table.id, option)}
                        key={option}
                      >
                        <i className={`status-dot ${option}`} />
                        {STATUS_LABELS[option]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </main>

        <aside className="orders-panel" aria-label="Commandes en attente">
          <div className="orders-panel-head">
            <h2>Commandes en attente</h2>
            {pending.length > 0 && <span className="orders-panel-count">{pending.length}</span>}
          </div>
          <div className="orders-panel-list">
            {pending.length === 0 ? (
              <div className="orders-panel-empty">
                <BellRinging size={26} weight="fill" />
                <p>Aucune commande en attente</p>
                <span>Les nouvelles commandes apparaîtront ici, avec un signal sonore.</span>
              </div>
            ) : (
              [...pending].reverse().map((order) => (
                <PendingOrderCard
                  key={order.id}
                  order={order}
                  highlighted={highlightedTable === String(order.table)}
                  onSelect={() => highlightTable(String(order.table))}
                  onAccept={() => act(order, "accept")}
                  onReject={() => act(order, "reject")}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PendingOrderCard({ order, highlighted, onSelect, onAccept, onReject }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0];
  const firstSummary = first ? `${first.quantity}× ${first.name}${first.size ? ` · ${first.size}` : ""}` : "";
  const extra = order.items.length - 1;
  return (
    <article className={`pending-card ${highlighted ? "is-highlighted" : ""}`} onClick={onSelect}>
      <div className="pending-card-top">
        <span className="pending-table">Table {order.table}</span>
        <span className="pending-time">{formatTime(order.createdAt)}</span>
      </div>
      <div className="pending-card-summary">
        <p className="pending-first">
          {firstSummary}
          {extra > 0 && <span className="pending-extra"> + {extra} autre{extra > 1 ? "s" : ""}</span>}
        </p>
        <p className="pending-meta">
          {itemCount} article{itemCount > 1 ? "s" : ""} · <strong>{money(order.total)}</strong>
        </p>
      </div>
      <div className="pending-card-actions">
        <button className="reject" onClick={(event) => { event.stopPropagation(); onReject(); }}>
          <XCircle weight="fill" size={18} /> Refuser
        </button>
        <button className="accept" onClick={(event) => { event.stopPropagation(); onAccept(); }}>
          <CheckCircle weight="fill" size={18} /> Accepter
        </button>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StaffApp />
  </React.StrictMode>,
);
