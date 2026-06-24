import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BellRinging, CheckCircle, Clock, Gear, XCircle } from "@phosphor-icons/react";
import "./styles.css";

const money = (value) => `${Number(value).toFixed(2)} CHF`;
const formatTime = (ms) =>
  new Date(ms).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });

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
  const audioRef = useRef(null);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setOrders(message.orders);
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

  async function act(id, action) {
    try {
      await fetch(`${API_BASE}/api/orders/${id}/${action}`, { method: "POST" });
    } catch {
      /* ignoré : le flux temps réel resynchronise l'état */
    }
  }

  const pending = orders.filter((order) => order.status === "pending");
  const handled = orders
    .filter((order) => order.status !== "pending")
    .slice(-6)
    .reverse();

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

      {!pending.length && (
        <div className="staff-empty">
          <div>
            <BellRinging size={32} weight="fill" />
          </div>
          <h2>Aucune commande en attente</h2>
          <p>Les nouvelles commandes des clients apparaîtront ici automatiquement, avec un signal sonore.</p>
        </div>
      )}

      {pending.map((order) => (
        <article className="order-card urgent" key={order.id}>
          <div className="order-card-head">
            <div>
              <span className="table-number">{order.table}</span>
              <div>
                <strong>Table {order.table}</strong>
                <small>Reçue à {formatTime(order.createdAt)}</small>
              </div>
            </div>
            <Clock weight="fill" size={26} />
          </div>

          <div className="staff-lines">
            {order.items.map((item, index) => (
              <div key={index}>
                <strong>{item.quantity}×</strong>
                <b>
                  {item.name}
                  {item.size ? ` · ${item.size}` : ""}
                </b>
                <span>{money(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="order-total">
            <span>Total</span>
            <strong>{money(order.total)}</strong>
          </div>

          <div className="order-actions">
            <button className="reject" onClick={() => act(order.id, "reject")}>
              <XCircle weight="fill" size={20} /> Refuser
            </button>
            <button className="accept" onClick={() => act(order.id, "accept")}>
              <CheckCircle weight="fill" size={20} /> Accepter
            </button>
          </div>
        </article>
      ))}

      {handled.length > 0 && (
        <div className="staff-history">
          <h2>Historique récent</h2>
          {handled.map((order) => (
            <div className={`history-row ${order.status}`} key={order.id}>
              <span className="history-table">Table {order.table}</span>
              <span className="history-status">
                {order.status === "accepted" ? (
                  <>
                    <CheckCircle weight="fill" size={18} /> Acceptée
                  </>
                ) : (
                  <>
                    <XCircle weight="fill" size={18} /> Refusée
                  </>
                )}
              </span>
              <span className="history-total">{money(order.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StaffApp />
  </React.StrictMode>,
);
