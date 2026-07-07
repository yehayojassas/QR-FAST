import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, BellRinging, CaretRight, CheckCircle, ForkKnife, Gear, SignOut, Star, X, XCircle } from "@phosphor-icons/react";
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

// Enregistre le service worker (app shell en cache, jamais les appels /api/) :
// démarrage instantané sur la tablette + résiste aux coupures Wi-Fi ponctuelles.
// Portée dynamique : "/" quand cette page est la racine du site (clickone-serveurs,
// dédié à l'équipe), "/staff" quand elle vit sous /staff sur clickone-menu (pour ne
// jamais affecter le menu client qui partage cette même origine).
if ("serviceWorker" in navigator) {
  const swScope = window.location.pathname.startsWith("/staff") ? "/staff" : "/";
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: swScope }).catch(() => {});
  });
}

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

const STAFF_PIN_KEY = "clickone_staff_pin";
const STAFF_ROLE_KEY = "clickone_staff_role";

// Efface le code retenu et revient à l'écran de connexion (ex: pour se
// reconnecter avec le code propriétaire à la place du code équipe).
function signOut() {
  sessionStorage.removeItem(STAFF_PIN_KEY);
  sessionStorage.removeItem(STAFF_ROLE_KEY);
  window.location.reload();
}

function StaffApp() {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [role, setRole] = useState(() => sessionStorage.getItem(STAFF_ROLE_KEY) || "staff");

  useEffect(() => {
    const storedPin = sessionStorage.getItem(STAFF_PIN_KEY) || "";
    fetch(`${API_BASE}/api/staff/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: storedPin }),
    })
      .then((response) => response.json())
      .then((data) => {
        setAuthorized(Boolean(data.ok));
        if (data.role) {
          setRole(data.role);
          sessionStorage.setItem(STAFF_ROLE_KEY, data.role);
        }
      })
      .catch(() => setAuthorized(false))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return null;
  if (!authorized) {
    return <StaffLogin onSuccess={(loggedRole) => { setRole(loggedRole); setAuthorized(true); }} />;
  }
  return <StaffDashboard role={role} />;
}

// Fetch qui ajoute le code PIN de l'équipe et renvoie à l'écran de connexion
// si le serveur le refuse (PIN changé/retiré entre-temps).
async function staffFetch(url, options = {}) {
  const pin = sessionStorage.getItem(STAFF_PIN_KEY) || "";
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), "X-Staff-Pin": pin },
  });
  if (response.status === 401) {
    sessionStorage.removeItem(STAFF_PIN_KEY);
    sessionStorage.removeItem(STAFF_ROLE_KEY);
    window.location.reload();
  }
  return response;
}

function StaffLogin({ onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json();
      if (data.ok) {
        sessionStorage.setItem(STAFF_PIN_KEY, pin);
        sessionStorage.setItem(STAFF_ROLE_KEY, data.role || "staff");
        onSuccess(data.role || "staff");
      } else {
        setError("Code incorrect.");
      }
    } catch {
      setError("Connexion impossible, réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="staff-login">
      <form className="staff-login-card" onSubmit={submit}>
        <h1>Accès équipe</h1>
        <p>Entrez le code fourni par le restaurant.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Code PIN"
        />
        {error && <span className="staff-login-error">{error}</span>}
        <button type="submit" disabled={pending}>{pending ? "…" : "Entrer"}</button>
      </form>
    </div>
  );
}

function StaffDashboard({ role }) {
  const isOwner = role === "owner";
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  // Placement dynamique du menu de statut pour qu'il reste toujours visible.
  const [popoverPos, setPopoverPos] = useState({ up: false, align: "center" });
  const [highlightedTable, setHighlightedTable] = useState(null);
  // Commande dont on affiche le détail complet (modal). null = fermée.
  const [detailId, setDetailId] = useState(null);
  // Table dont on consulte les plats servis (modal "Voir la table"). null = fermée.
  const [tableViewId, setTableViewId] = useState(null);
  // Statuts des tables, source de vérité = backend (synchronisé en temps réel).
  const [statuses, setStatuses] = useState({});
  // Appels "un serveur svp" en attente, par table.
  const [helpCalls, setHelpCalls] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const audioRef = useRef(null);
  const highlightTimer = useRef(null);

  useEffect(() => {
    // Réservé au propriétaire : un compte "staff" n'a pas le droit de lire
    // /api/reviews, inutile (et risqué, ça déclencherait une déconnexion) de
    // tenter l'appel avec son PIN.
    if (!isOwner) return;
    staffFetch(`${API_BASE}/api/reviews`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setReviews)
      .catch(() => {});
  }, []);

  // Empêche la tablette de s'éteindre pendant le service. Le wake lock est
  // relâché automatiquement par le navigateur quand l'onglet passe en arrière-
  // plan : on le redemande à chaque retour au premier plan.
  useEffect(() => {
    let wakeLock = null;
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        /* non-critique (ex: batterie faible) */
      }
    }
    requestWakeLock();
    function handleVisibility() {
      if (document.visibilityState === "visible") requestWakeLock();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/stream`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setOrders(message.orders);
        if (message.statuses) setStatuses(message.statuses);
        setHelpCalls(message.helpCalls || []);
      } else if (message.type === "tableStatus") {
        setStatuses((current) => ({ ...current, [message.table]: message.status }));
      } else if (message.type === "ordersCleared") {
        // Table remise "Libre" : on retire les commandes servies effacées.
        const removed = new Set(message.ids);
        setOrders((current) => current.filter((order) => !removed.has(order.id)));
      } else if (message.type === "help") {
        beep();
        setHelpCalls((current) => [...current.filter((call) => call.table !== message.call.table), message.call]);
      } else if (message.type === "helpResolved") {
        setHelpCalls((current) => current.filter((call) => call.table !== message.table));
      } else if (message.type === "review") {
        setReviews((current) => [message.review, ...current]);
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
      await staffFetch(`${API_BASE}/api/tables/${table}/status`, {
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
      await staffFetch(`${API_BASE}/api/orders/${order.id}/${action}`, { method: "POST" });
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

  // Clic sur une commande du panneau : ouvre le détail complet + met la table
  // en évidence sur le plan.
  function openDetail(order) {
    setDetailId(order.id);
    highlightTable(String(order.table));
  }

  const pending = orders.filter((order) => order.status === "pending");
  // Commande affichée en détail (toujours relue depuis l'état à jour). Si elle
  // n'est plus en attente (acceptée/refusée ailleurs), la modal se ferme.
  const detailOrder = detailId == null ? null : pending.find((order) => order.id === detailId);
  useEffect(() => {
    if (detailId != null && !pending.some((order) => order.id === detailId)) setDetailId(null);
  }, [detailId, pending]);
  // Commandes acceptées (servies / en cours) regroupées par table.
  const acceptedByTable = orders
    .filter((order) => order.status === "accepted")
    .reduce((acc, order) => {
      const table = String(order.table);
      acc[table] = [...(acc[table] || []), order];
      return acc;
    }, {});
  const acceptedTables = new Set(Object.keys(acceptedByTable));
  const pendingByTable = pending.reduce((acc, order) => {
    const table = String(order.table);
    acc[table] = [...(acc[table] || []), order];
    return acc;
  }, {});

  // Modal "Voir la table" : commandes servies de la table consultée. Se ferme
  // automatiquement si la table n'a plus de commande (remise en "Libre").
  const tableViewOrders = tableViewId == null ? [] : (acceptedByTable[tableViewId] || []);
  useEffect(() => {
    if (tableViewId != null && !(acceptedByTable[tableViewId]?.length)) setTableViewId(null);
  }, [tableViewId, acceptedByTable]);

  function openTableView(tableId) {
    setSelectedTable(null);
    setTableViewId(tableId);
  }

  async function resolveHelp(table) {
    setHelpCalls((current) => current.filter((call) => call.table !== table));
    try {
      await staffFetch(`${API_BASE}/api/help/${table}/resolve`, { method: "POST" });
    } catch {
      /* ignoré : le flux temps réel resynchronise l'état */
    }
  }

  const callingTables = new Set(helpCalls.map((call) => call.table));

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
          <span className={`role-pill ${isOwner ? "owner" : ""}`}>{isOwner ? "Propriétaire" : "Équipe"}</span>
          <span className={`live-pill ${pending.length ? "ringing" : ""}`}>
            <span />
            {connected ? (pending.length ? `${pending.length} en attente` : "En ligne") : "Connexion…"}
          </span>
          {isOwner && (
            <button className="staff-reviews-toggle" onClick={() => setReviewsOpen(true)} aria-label="Voir les avis clients" title="Avis clients">
              <Star size={20} weight="fill" />
              {reviews.length > 0 && <span className="staff-reviews-count">{reviews.length}</span>}
            </button>
          )}
          <button className="staff-settings" onClick={configureMenuAddress} aria-label="Configurer l'adresse du menu" title="Configurer l'adresse du menu">
            <Gear size={20} />
          </button>
          <button className="staff-settings" onClick={signOut} aria-label="Changer de code / se déconnecter" title="Changer de code">
            <SignOut size={20} />
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
            const isCalling = callingTables.has(table.id);
            return (
              <div
                className={`table-zone table-zone-${table.id} ${hasOrder ? "has-order" : ""} ${highlightedTable === table.id ? "is-highlighted" : ""} ${selectedTable === table.id ? "is-active" : ""}`}
                style={{ left: `${table.x}%`, top: `${table.y}%` }}
                key={table.id}
              >
                <button
                  className={`restaurant-table ${table.shape} status-${status} ${selectedTable === table.id ? "is-selected" : ""} ${isCalling ? "is-calling" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleStatusMenu(table.id, event.currentTarget);
                  }}
                  aria-label={`Table ${table.id}, ${STATUS_LABELS[status]}${tableOrders.length ? `, ${tableOrders.length} commande${tableOrders.length > 1 ? "s" : ""} en attente` : ""}${isCalling ? ", appelle un serveur" : ""}`}
                >
                  {hasOrder && (
                    <span className="table-order-count" aria-hidden="true">{tableOrders.length}</span>
                  )}
                  {isCalling && (
                    <span className="table-calling-badge" aria-hidden="true"><Bell size={16} weight="fill" /></span>
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
                    {isCalling && (
                      <button className="popover-resolve-help" onClick={() => resolveHelp(table.id)}>
                        <Bell size={16} weight="fill" />
                        Appel traité
                      </button>
                    )}
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
                    {acceptedByTable[table.id]?.length > 0 && (
                      <button className="popover-view-table" onClick={() => openTableView(table.id)}>
                        <ForkKnife size={16} weight="fill" />
                        Voir la table
                      </button>
                    )}
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
                  onSelect={() => openDetail(order)}
                  onAccept={() => act(order, "accept")}
                  onReject={() => act(order, "reject")}
                />
              ))
            )}
          </div>
        </aside>
      </div>

      {detailOrder && (
        <div className="order-detail-overlay" role="dialog" aria-modal="true" aria-label={`Détail commande table ${detailOrder.table}`}>
          <button className="order-detail-backdrop" onClick={() => setDetailId(null)} aria-label="Fermer le détail" />
          <section className="order-detail">
            <header className="order-detail-head">
              <div>
                <span className="order-detail-table">Table {detailOrder.table}</span>
                <span className="order-detail-time">Reçue à {formatTime(detailOrder.createdAt)}</span>
              </div>
              <button className="order-detail-close" onClick={() => setDetailId(null)} aria-label="Fermer">
                <X size={20} />
              </button>
            </header>

            <div className="order-detail-lines">
              {detailOrder.items.map((item, index) => (
                <div className="order-detail-line" key={index}>
                  <span className="odl-qty">{item.quantity}×</span>
                  <span className="odl-name">
                    {item.name}
                    {item.size ? <small> · {item.size}</small> : null}
                  </span>
                  <span className="odl-price">{money(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {detailOrder.tip > 0 && (
              <div className="order-detail-total order-detail-subline">
                <span>Sous-total</span>
                <span>{money(detailOrder.subtotal ?? (detailOrder.total - detailOrder.tip))}</span>
              </div>
            )}
            {detailOrder.tip > 0 && (
              <div className="order-detail-total order-detail-subline">
                <span>Pourboire</span>
                <span>{money(detailOrder.tip)}</span>
              </div>
            )}
            <div className="order-detail-total">
              <span>Total</span>
              <strong>{money(detailOrder.total)}</strong>
            </div>

            <div className="order-detail-actions">
              <button className="reject" onClick={() => { act(detailOrder, "reject"); setDetailId(null); }}>
                <XCircle weight="fill" size={20} /> Refuser
              </button>
              <button className="accept" onClick={() => { act(detailOrder, "accept"); setDetailId(null); }}>
                <CheckCircle weight="fill" size={20} /> Accepter
              </button>
            </div>
          </section>
        </div>
      )}

      {tableViewId != null && tableViewOrders.length > 0 && (
        <TableView
          tableId={tableViewId}
          orders={tableViewOrders}
          onClose={() => setTableViewId(null)}
          onFree={() => { setTableStatus(tableViewId, "free"); setTableViewId(null); }}
        />
      )}

      {reviewsOpen && <ReviewsPanel reviews={reviews} onClose={() => setReviewsOpen(false)} />}
    </div>
  );
}

// Panneau des avis clients : privé, jamais visible des clients ni public.
function ReviewsPanel({ reviews, onClose }) {
  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : null;
  return (
    <div className="order-detail-overlay" role="dialog" aria-modal="true" aria-label="Avis clients">
      <button className="order-detail-backdrop" onClick={onClose} aria-label="Fermer" />
      <section className="order-detail reviews-panel">
        <header className="order-detail-head">
          <div>
            <span className="order-detail-table">Avis clients</span>
            {average && <span className="order-detail-time">Moyenne : {average}/5 sur {reviews.length} avis</span>}
          </div>
          <button className="order-detail-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>
        <div className="reviews-list">
          {reviews.length === 0 && <p className="reviews-empty">Aucun avis pour l'instant.</p>}
          {reviews.map((review) => (
            <div className="review-row" key={review.id}>
              <div className="review-row-head">
                <span className="review-row-stars">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} size={14} weight={value <= review.rating ? "fill" : "regular"} />
                  ))}
                </span>
                <span className="review-row-meta">Table {review.table} · {formatTime(review.createdAt)}</span>
              </div>
              {review.comment && <p className="review-row-comment">{review.comment}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Modal "Voir la table" : agrège les plats servis (commandes acceptées) de la
// table, regroupés par article + taille, avec total et heures.
function TableView({ tableId, orders, onClose, onFree }) {
  const groups = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.name}__${item.size || ""}`;
      const existing = groups.get(key);
      if (existing) existing.quantity += item.quantity;
      else groups.set(key, { name: item.name, size: item.size || "", price: item.price, quantity: item.quantity });
    }
  }
  const lines = [...groups.values()];
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const times = orders.map((order) => formatTime(order.createdAt));
  return (
    <div className="order-detail-overlay" role="dialog" aria-modal="true" aria-label={`Plats servis table ${tableId}`}>
      <button className="order-detail-backdrop" onClick={onClose} aria-label="Fermer" />
      <section className="order-detail table-view">
        <header className="order-detail-head">
          <div>
            <span className="order-detail-table">Table {tableId}</span>
            <span className="order-detail-time">
              Servie · {orders.length} commande{orders.length > 1 ? "s" : ""} · {times.join(", ")}
            </span>
          </div>
          <button className="order-detail-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="order-detail-lines">
          {lines.map((line, index) => (
            <div className="order-detail-line" key={index}>
              <span className="odl-qty">{line.quantity}×</span>
              <span className="odl-name">
                {line.name}
                {line.size ? <small> · {line.size}</small> : null}
              </span>
              <span className="odl-price">{money(line.price * line.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="order-detail-total">
          <span>Total table</span>
          <strong>{money(total)}</strong>
        </div>

        <div className="order-detail-actions table-view-actions">
          <button className="free" onClick={onFree}>Libérer la table</button>
        </div>
      </section>
    </div>
  );
}

function PendingOrderCard({ order, highlighted, onSelect, onAccept, onReject }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = order.items[0];
  const firstSummary = first ? `${first.quantity}× ${first.name}${first.size ? ` · ${first.size}` : ""}` : "";
  const extra = order.items.length - 1;
  return (
    <article className={`pending-card ${highlighted ? "is-highlighted" : ""}`} onClick={onSelect} role="button" tabIndex={0} title="Voir le détail">
      <div className="pending-card-top">
        <span className="pending-table">Table {order.table}</span>
        <span className="pending-top-right">
          <span className="pending-time">{formatTime(order.createdAt)}</span>
          <CaretRight className="pending-caret" size={15} weight="bold" />
        </span>
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
