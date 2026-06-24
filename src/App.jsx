import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BellRinging, CaretRight, CheckCircle, Clock, Minus, Plus, Sparkle, Trash, X } from '@phosphor-icons/react';

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Nachos à partager', price: 16.5, category: 'À partager', image: '/products/nachos.png', description: 'Sauce mexicaine fraîche maison' },
  { id: 6, name: 'Salade Tricolore', price: 19, category: 'Salades', image: '/products/tricolore.png', description: 'Roquette, tomate cerise, burrata' },
  { id: 2, name: 'Mini arancini', price: 14, category: 'Entrées', image: '/products/arancini.png', description: 'Bouchées de riz croustillantes' },
  { id: 7, name: 'Carbonara', price: 25, category: 'Plats', image: '/products/carbonara.png', description: 'Spaghetti, guanciale, œuf et pecorino' },
  { id: 3, name: 'Planchette maison', price: 28, category: 'À partager', image: '/products/planchette.png', description: 'Charcuteries & fromages' },
  { id: 8, name: 'Mojito', price: 16, category: 'Boissons', image: '/products/mojito.png', description: 'Rhum, menthe, citron et soda' },
  { id: 4, name: 'Pimientos de Padrón', price: 12, category: 'Entrées', image: '/products/pimientos.png', description: 'Fleur de sel' },
  { id: 5, name: 'Filets de perche', price: 39, category: 'Plats', image: '/products/perche.png', description: 'Frites, sauce tartare maison, salade verte' },
];

const CATEGORIES = ['À partager', 'Plats', 'Salades', 'Pâtes', 'Enfants', 'Desserts', 'Vins', 'Bières', 'Boissons', 'Cocktails', 'Spiritueux'];
const money = (value) => `${value.toFixed(2)} CHF`;
const TABLE = new URLSearchParams(window.location.search).get('table') || '7';

const ORDER_LIMIT = 5;     // au-delà de 5 commandes ouvertes, on fait patienter
const WAIT_SECONDS = 30;   // durée du compte à rebours d'envoi quand c'est saturé
const CART_KEY = `clickone:cart:${TABLE}`;
const ORDERS_KEY = `clickone:orders:${TABLE}`;
const loadStored = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};

const EXACT_IMAGES = {
  'Nachos à partager': '/products/nachos.png',
  'Mini arancini': '/products/arancini.png',
  'Planchette maison': '/products/planchette.png',
  'Pimientos de Padrón frits': '/products/pimientos.png',
  'Filets de perche meunière': '/products/perche.png',
  'Salade Tricolore': '/products/tricolore.png',
  Carbonara: '/products/carbonara.png',
  Mojito: '/products/mojito.png',
  Tiramisu: '/products/dessert.png',
};

function displayCategory(category) {
  if (['Vin blanc', 'Vin rouge', 'Vin rosé', 'Bollicine'].includes(category)) return 'Vins';
  if (['Boissons froides', 'Eau filtrée'].includes(category)) return 'Boissons';
  if (['Signature', 'Mojito', 'Spritz', 'Classiques', 'Fruités', 'Sans alcool'].includes(category)) return 'Cocktails';
  if (['Digestifs', 'Apéritifs'].includes(category)) return 'Spiritueux';
  return category;
}

function categoryImage(row, productImages = {}) {
  if (productImages[row.article]) return productImages[row.article];
  if (EXACT_IMAGES[row.article]) return EXACT_IMAGES[row.article];
  if (row.categorie === 'Vin blanc') return '/products/white-wine.png';
  if (row.categorie === 'Vin rouge') return '/products/red-wine.png';
  if (['Vin rosé', 'Bollicine'].includes(row.categorie)) return '/products/rose-sparkling.png';
  if (row.categorie === 'Bières') return '/products/beer.png';
  if (['Boissons froides', 'Eau filtrée'].includes(row.categorie)) return '/products/soft-drink.png';
  if (['Digestifs', 'Apéritifs'].includes(row.categorie)) return '/products/spirits.png';
  if (['Signature', 'Mojito', 'Spritz', 'Classiques', 'Fruités', 'Sans alcool'].includes(row.categorie)) return '/products/cocktail.png';
  if (row.categorie === 'Desserts') return '/products/dessert.png';
  if (row.categorie === 'Pâtes') return '/products/carbonara.png';
  if (row.categorie === 'Salades') return '/products/tricolore.png';
  if (row.categorie === 'Enfants') return '/products/arancini.png';
  if (row.categorie === 'À partager') return '/products/nachos.png';
  return '/products/perche.png';
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export function App() {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [category, setCategory] = useState('À partager');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => loadStored(CART_KEY, {}));
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [myOrders, setMyOrders] = useState(() => loadStored(ORDERS_KEY, [])); // { id, status }, persistées
  const [toast, setToast] = useState('');
  const [rotation, setRotation] = useState(0);
  const [openCount, setOpenCount] = useState(0);   // nombre de commandes ouvertes côté serveur
  const [countdown, setCountdown] = useState(0);    // secondes restantes avant envoi auto (0 = inactif)
  const allOrdersRef = useRef(new Map());           // id -> statut (toutes les commandes)
  const queuedRef = useRef(null);                   // commande capturée en attente d'envoi
  const dragStart = useRef(null);
  const myOrdersRef = useRef([]);
  useEffect(() => { myOrdersRef.current = myOrders; }, [myOrders]);
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* stockage indisponible */ } }, [cart]);
  useEffect(() => { try { localStorage.setItem(ORDERS_KEY, JSON.stringify(myOrders)); } catch { /* stockage indisponible */ } }, [myOrders]);

  useEffect(() => {
    Promise.all([
      fetch('/menu.csv').then((response) => response.text()),
      fetch('/product-images.json').then((response) => response.json()).catch(() => ({})),
    ]).then(([text, productImages]) => {
      const loaded = parseCsv(text).map((row, index) => ({
        id: index + 1,
        name: row.article,
        price: Number(row.prix_chf),
        category: displayCategory(row.categorie),
        sourceCategory: row.categorie,
        image: categoryImage(row, productImages),
        description: row.description || row.categorie,
        size: row.contenance,
        type: row.type,
      }));
      if (loaded.length) setProducts(loaded);
    });
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = product.category === category;
    const needle = search.trim().toLocaleLowerCase('fr');
    return categoryMatch && (!needle || `${product.name} ${product.description}`.toLocaleLowerCase('fr').includes(needle));
  }), [category, products, search]);
  const isSharePage = category === 'À partager';

  const lines = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function add(product) {
    setCart((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }));
    flash(`${product.name} ajouté`);
  }

  function changeQuantity(product, amount) {
    setCart((current) => {
      const next = Math.max(0, (current[product.id] || 0) + amount);
      const updated = { ...current };
      if (next === 0) delete updated[product.id];
      else updated[product.id] = next;
      return updated;
    });
  }

  function recomputeOpen() {
    let count = 0;
    for (const status of allOrdersRef.current.values()) if (status === 'pending') count += 1;
    setOpenCount(count);
  }

  // Envoi réel d'une commande déjà capturée (payload figé).
  async function submitOrder(payload) {
    setCart({});
    setCartOpen(false);
    flash('Commande envoyée aux serveurs');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: TABLE, total: payload.total, items: payload.items }),
      });
      if (!response.ok) throw new Error('send failed');
      const data = await response.json();
      setMyOrders((current) => [...current, { id: data.id, status: 'pending' }]);
    } catch {
      flash('Échec de l’envoi, réessayez');
    }
  }

  function sendOrder() {
    if (!itemCount || countdown > 0) return;
    const payload = {
      total,
      items: lines.map((line) => ({ name: line.name, price: line.price, quantity: line.quantity, size: line.size || '' })),
    };
    // Service saturé (≥ ORDER_LIMIT commandes ouvertes) : on impose une attente.
    if (openCount >= ORDER_LIMIT) {
      queuedRef.current = payload;
      setCartOpen(false);
      setCountdown(WAIT_SECONDS);
      flash(`Trop de commandes en cours · envoi dans ${WAIT_SECONDS}s`);
    } else {
      submitOrder(payload);
    }
  }

  // Compte à rebours : à 0, la commande en attente part automatiquement.
  useEffect(() => {
    if (countdown <= 0) {
      if (queuedRef.current) {
        const payload = queuedRef.current;
        queuedRef.current = null;
        submitOrder(payload);
      }
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  // Suit en direct le statut des commandes de ce client + le nombre de
  // commandes ouvertes côté serveur (pour le rythme d'envoi).
  useEffect(() => {
    const source = new EventSource('/api/stream');
    source.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // À la connexion (ou reconnexion) : état réel complet du serveur.
      if (message.type === 'snapshot') {
        allOrdersRef.current = new Map(message.orders.map((order) => [order.id, order.status]));
        recomputeOpen();
        // Réconcilie mes commandes persistées avec la réalité du serveur.
        const mine = myOrdersRef.current;
        if (mine.length) {
          const known = allOrdersRef.current;
          let accepted = false; let rejected = false;
          const still = [];
          for (const order of mine) {
            const status = known.get(order.id);
            if (status === undefined) continue;          // commande perdue (serveur redémarré)
            if (status === 'accepted') { accepted = true; continue; }
            if (status === 'rejected') { rejected = true; continue; }
            still.push({ id: order.id, status: 'pending' });
          }
          if (accepted) flash('Votre commande a été acceptée ✅');
          else if (rejected) flash('Votre commande a été refusée');
          setMyOrders(still);
        }
        return;
      }

      if (message.type !== 'order') return;
      const { order } = message;
      allOrdersRef.current.set(order.id, order.status);
      recomputeOpen();
      const mine = myOrdersRef.current.find((entry) => entry.id === order.id);
      if (!mine) return;
      // Dès acceptation/refus : on notifie puis la commande disparaît.
      if (order.status === 'accepted') {
        flash('Votre commande a été acceptée ✅');
        setMyOrders((current) => current.filter((entry) => entry.id !== order.id));
      } else if (order.status === 'rejected') {
        flash('Votre commande a été refusée');
        setMyOrders((current) => current.filter((entry) => entry.id !== order.id));
      }
    };
    return () => source.close();
  }, []);

  return (
    <div className="app-shell">
      <img className="botanical-deco botanical-deco-top" src="/botanical-corner.png" alt="" aria-hidden="true" />
      <img className="botanical-deco botanical-deco-bottom" src="/botanical-corner.png" alt="" aria-hidden="true" />
      <header className="demo-header">
        <button className="brand" aria-label="Accueil ClickOne"><span>C.O</span></button>
        <button className="table-pill" aria-label={`Table ${TABLE}`}>Table {TABLE} <img src="/table-icon-3d.png" alt="" /></button>
      </header>

      <main className="client-view">
        {countdown > 0 && <section className="status-banner pending"><div className="status-icon"><Clock weight="fill" /></div><div><strong>Trop de commandes en cours</strong><span>Votre commande part automatiquement dans {countdown}s…</span></div></section>}
        {myOrders.length > 0 && <OrdersBanner orders={myOrders} />}
        <CategoryNav category={category} setCategory={setCategory} />
        <CategoryTitle category={category} count={visibleProducts.length} isSharePage={isSharePage} />
        {isSharePage ? (
          <ShareCategory
            products={visibleProducts}
            cart={cart}
            add={add}
            changeQuantity={changeQuantity}
            setSelected={setSelected}
            setRotation={setRotation}
          />
        ) : (
          <MenuList
            products={visibleProducts}
            cart={cart}
            add={add}
            changeQuantity={changeQuantity}
            setSelected={setSelected}
            setRotation={setRotation}
          />
        )}
        {!visibleProducts.length && <div className="empty-state">Aucun produit ne correspond à votre recherche.</div>}
        {itemCount > 0 && <button className="cart-bar" onClick={() => setCartOpen(true)}><span className="cart-count">{itemCount}</span><span>Voir ma commande</span><strong>{money(total)}</strong></button>}
      </main>

      {selected && <div className="overlay" role="dialog" aria-modal="true" aria-label={selected.name}>
        <button className="overlay-backdrop" onClick={() => setSelected(null)} aria-label="Fermer" />
        <section className="product-sheet"><div className="sheet-topline"><button className="icon-button" onClick={() => setSelected(null)} aria-label="Retour"><ArrowLeft size={22} /></button><span>Vue 360°</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><X size={22} /></button></div>
          <div className="rotate-stage" onPointerDown={(event) => { dragStart.current = { x: event.clientX, rotation }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragStart.current) setRotation(dragStart.current.rotation + (event.clientX - dragStart.current.x) * .7); }} onPointerUp={() => { dragStart.current = null; }}>
            <img src={selected.image} alt={selected.name} style={{ transform: `rotateY(${rotation}deg)` }} draggable="false" decoding="async" /><p>Glissez pour tourner le plat</p>
          </div>
          <div className="sheet-copy"><p className="eyebrow">{selected.sourceCategory || selected.category}</p><h2>{selected.name}</h2><p>{selected.description}{selected.size ? ` · ${selected.size}` : ''}</p><div className="sheet-action"><strong>{money(selected.price)}</strong><button className="primary-button" onClick={() => { add(selected); setSelected(null); }}><Plus size={20} weight="bold" /> Ajouter</button></div></div>
        </section>
      </div>}

      {cartOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Votre commande"><button className="overlay-backdrop" onClick={() => setCartOpen(false)} aria-label="Fermer" /><section className="cart-sheet">
        <div className="sheet-topline"><div><p className="eyebrow">Table {TABLE}</p><h2>Votre commande</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Fermer"><X size={22} /></button></div>
        <div className="cart-lines">{lines.map((line) => <div className="cart-line" key={line.id}><img src={line.image} alt="" loading="lazy" decoding="async" /><div><strong>{line.name}</strong><span>{money(line.price)}</span></div><div className="mini-stepper"><button onClick={() => changeQuantity(line, -1)} aria-label="Retirer">{line.quantity === 1 ? <Trash /> : <Minus />}</button><strong>{line.quantity}</strong><button onClick={() => changeQuantity(line, 1)} aria-label="Ajouter"><Plus /></button></div></div>)}</div>
        <div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div><button className="send-button" onClick={sendOrder} disabled={countdown > 0}><BellRinging size={22} weight="fill" /> {countdown > 0 ? `Envoi dans ${countdown}s` : 'Envoyer aux serveurs'}</button><p className="payment-note">Aucun paiement maintenant. Vous réglerez en partant.</p>
      </section></div>}
      {toast && <div className="toast"><CheckCircle weight="fill" /> {toast}</div>}
    </div>
  );
}

function CategoryNav({ category, setCategory }) {
  const activeIndex = Math.max(0, CATEGORIES.indexOf(category));
  const progress = `${Math.min(100, ((activeIndex + 1) / CATEGORIES.length) * 100)}%`;
  return (
    <div className="menu-nav-wrap">
      <nav className="category-strip" aria-label="Catégories">
        {CATEGORIES.map((item) => (
          <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
        <span className="nav-more" aria-hidden="true"><CaretRight size={17} /></span>
      </nav>
      <div className="swipe-indicator" aria-hidden="true"><span style={{ width: progress }} /></div>
    </div>
  );
}

function CategoryTitle({ category, count, isSharePage }) {
  const suffix = category === 'À partager' || ['Plats', 'Salades', 'Pâtes', 'Desserts'].includes(category) ? 'plats' : 'articles';
  return (
    <section className={`category-title ${isSharePage ? 'share-title' : ''}`}>
      <h1>{category}</h1>
      <span>{String(count).padStart(2, '0')} {suffix}</span>
    </section>
  );
}

function ProductStepper({ product, cart, add, changeQuantity, className = '' }) {
  return cart[product.id] ? (
    <div className={`mini-stepper ${className}`}>
      <button onClick={() => changeQuantity(product, -1)} aria-label="Retirer"><Minus /></button>
      <strong>{cart[product.id]}</strong>
      <button onClick={() => changeQuantity(product, 1)} aria-label="Ajouter"><Plus /></button>
    </div>
  ) : (
    <button className={`quick-add ${className}`} onClick={() => add(product)} aria-label={`Ajouter ${product.name}`}>
      <Plus weight="bold" />
    </button>
  );
}

function ViewButton({ product, setSelected, setRotation, className = '' }) {
  return (
    <button
      className={`view-360 ${className}`}
      onClick={() => { setSelected(product); setRotation(0); }}
      aria-label={`Voir ${product.name} en 360 degrés`}
    >
      <Sparkle size={13} weight="fill" /> 360°
    </button>
  );
}

function ShareCategory({ products, cart, add, changeQuantity, setSelected, setRotation }) {
  const [featured, ...rest] = products;
  if (!featured) return null;
  return (
    <section className="share-menu" aria-label="Produits À partager">
      <article className="share-featured">
        <span className="share-index">01</span>
        <button className="share-photo" onClick={() => { setSelected(featured); setRotation(0); }} aria-label={`Voir ${featured.name}`}>
          <img src={featured.image} alt={featured.name} decoding="async" />
          <ViewButton product={featured} setSelected={setSelected} setRotation={setRotation} />
        </button>
        <div className="share-copy">
          <button onClick={() => { setSelected(featured); setRotation(0); }}><h2>{featured.name}</h2></button>
          {featured.description && <p>{featured.description}</p>}
          <strong>{money(featured.price)}</strong>
        </div>
        <ProductStepper product={featured} cart={cart} add={add} changeQuantity={changeQuantity} className="share-add" />
      </article>
      <div className="share-rest">
        {rest.map((product, index) => (
          <article className="share-row" key={product.id}>
            <button className="share-row-photo" onClick={() => { setSelected(product); setRotation(0); }}>
              <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
            </button>
            <div className="share-row-copy">
              <span>{String(index + 2).padStart(2, '0')}</span>
              <button onClick={() => { setSelected(product); setRotation(0); }}><h2>{product.name}</h2></button>
              {product.description && <p>{product.description}</p>}
              <strong>{money(product.price)}</strong>
              <ViewButton product={product} setSelected={setSelected} setRotation={setRotation} />
            </div>
            <ProductStepper product={product} cart={cart} add={add} changeQuantity={changeQuantity} />
          </article>
        ))}
      </div>
    </section>
  );
}

function MenuList({ products, cart, add, changeQuantity, setSelected, setRotation }) {
  return (
    <section className="menu-list" aria-label="Produits">
      {products.map((product, index) => {
        const isChef = index === 2 && products.length >= 5 && ['Plats', 'Salades', 'Pâtes'].includes(product.category);
        return (
          <article className={`menu-row ${isChef ? 'chef-row' : ''}`} key={product.id}>
            {isChef && <span className="chef-label"><Sparkle size={13} weight="fill" /> Suggestion du chef</span>}
            <button className="menu-thumb" onClick={() => { setSelected(product); setRotation(0); }} aria-label={`Voir ${product.name}`}>
              <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
            </button>
            <div className="menu-copy">
              <button onClick={() => { setSelected(product); setRotation(0); }}><h2>{product.name}</h2></button>
              <p>{[product.description, product.size].filter(Boolean).join(' · ') || product.sourceCategory || product.category}</p>
              <strong>{money(product.price)}</strong>
            </div>
            <div className="menu-actions">
              <ViewButton product={product} setSelected={setSelected} setRotation={setRotation} />
              <ProductStepper product={product} cart={cart} add={add} changeQuantity={changeQuantity} />
            </div>
          </article>
        );
      })}
      <div className="menu-end" aria-hidden="true"><span /><b>✣</b><span /></div>
    </section>
  );
}

// Bannière persistante : reste affichée tant que la (les) commande(s) sont en
// attente. Elle disparaît d'elle-même dès que le serveur accepte ou refuse
// (la commande est alors retirée de la liste), même après un rafraîchissement.
function OrdersBanner({ orders }) {
  const pending = orders.length;
  const title = pending > 1 ? `${pending} commandes envoyées` : 'Commande envoyée';
  return <section className="status-banner pending"><div className="status-icon"><Clock weight="fill" /></div><div><strong>{title}</strong><span>En attente de validation par les serveurs.</span></div></section>;
}
