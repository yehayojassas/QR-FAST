import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BellRinging, CheckCircle, Gear, XCircle } from "@phosphor-icons/react";
import "./styles.css";

const money = (value) => `${Number(value).toFixed(2)} CHF`;
const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
// Disposition en 4-2-4 (couloir central) avec rangées décalées : chaque alerte
// de commande remonte (ou descend, pour la rangée du haut) dans un espace vide,
// jamais au-dessus d'une autre table. alertBelow = l'alerte s'ouvre vers le bas.
const TABLES = [
  { id: "1", seats: 2, shape: "round", x: 13, y: 16, alertBelow: true },
  { id: "2", seats: 4, shape: "square", x: 38, y: 16, alertBelow: true },
  { id: "3", seats: 2, shape: "round", x: 62, y: 16, alertBelow: true },
  { id: "4", seats: 4, shape: "square", x: 87, y: 16, alertBelow: true },
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
  // Statuts des tables, source de vérité = backend (synchronisé en temps réel).
  const [statuses, setStatuses] = useState({});
  const audioRef = useRef(null);

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

      <main className="dining-room" onClick={() => setSelectedTable(null)}>
        {TABLES.map((table) => {
          const tableOrders = pendingByTable[table.id] || [];
          const latestOrder = tableOrders[tableOrders.length - 1];
          const status = getTableStatus(table.id);
          return (
            <div
              className={`table-zone table-zone-${table.id} ${latestOrder ? "has-order" : ""}`}
              style={{ left: `${table.x}%`, top: `${table.y}%` }}
              key={table.id}
            >
              {latestOrder && (
                <OrderAlert
                  order={latestOrder}
                  count={tableOrders.length}
                  below={table.alertBelow}
                  onAccept={() => act(latestOrder, "accept")}
                  onReject={() => act(latestOrder, "reject")}
                />
              )}

              <button
                className={`restaurant-table ${table.shape} status-${status} ${selectedTable === table.id ? "is-selected" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTable((current) => (current === table.id ? null : table.id));
                }}
                aria-label={`Table ${table.id}, ${STATUS_LABELS[status]}${tableOrders.length ? `, ${tableOrders.length} commande${tableOrders.length > 1 ? "s" : ""} en attente` : ""}`}
              >
                {tableOrders.length > 0 && (
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
                <div className="table-status-popover" onClick={(event) => event.stopPropagation()}>
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
    </div>
  );
}

function OrderAlert({ order, count, below, onAccept, onReject }) {
  const previewItems = order.items.slice(0, 2);
  return (
    <article className={`table-order-alert ${below ? "below" : ""} ${count > 1 ? "stacked" : ""}`}>
      {count > 1 && <span className="alert-stack-badge" aria-hidden="true">+{count - 1}</span>}
      <div className="table-order-alert-head">
        <span className="order-alert-icon">
          <BellRinging size={17} weight="fill" />
        </span>
        <div>
          <strong>{count > 1 ? `${count} commandes en attente` : "Nouvelle commande"}</strong>
          <small>Table {order.table} · {formatTime(order.createdAt)}</small>
        </div>
      </div>
      <div className="table-order-lines">
        {previewItems.map((item, index) => (
          <span key={index}>
            {item.quantity}× {item.name}{item.size ? ` · ${item.size}` : ""}
          </span>
        ))}
        {order.items.length > previewItems.length && <span>+ {order.items.length - previewItems.length} autre</span>}
      </div>
      <div className="table-order-bottom">
        <strong>{money(order.total)}</strong>
        <div>
          <button className="reject" onClick={onReject} aria-label="Refuser la commande">
            <XCircle weight="fill" size={18} />
          </button>
          <button className="accept" onClick={onAccept} aria-label="Accepter la commande">
            <CheckCircle weight="fill" size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StaffApp />
  </React.StrictMode>,
);
