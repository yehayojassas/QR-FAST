import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BellRinging, CheckCircle, Clock, MagnifyingGlass, Minus, Plus, SlidersHorizontal, Sparkle, Trash, X, XCircle } from '@phosphor-icons/react';

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

function categoryImage(row) {
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
  const [cart, setCart] = useState({});
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('draft');
  const [orderId, setOrderId] = useState(null);
  const [toast, setToast] = useState('');
  const [rotation, setRotation] = useState(0);
  const dragStart = useRef(null);

  useEffect(() => {
    fetch('/menu.csv').then((response) => response.text()).then((text) => {
      const loaded = parseCsv(text).map((row, index) => ({
        id: index + 1,
        name: row.article,
        price: Number(row.prix_chf),
        category: displayCategory(row.categorie),
        sourceCategory: row.categorie,
        image: categoryImage(row),
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

  const lines = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function add(product) {
    if (orderStatus !== 'draft') return;
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

  async function sendOrder() {
    if (!itemCount) return;
    setOrderStatus('pending');
    setCartOpen(false);
    flash('Commande envoyée aux serveurs');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: TABLE,
          total,
          items: lines.map((line) => ({ name: line.name, price: line.price, quantity: line.quantity, size: line.size || '' })),
        }),
      });
      if (!response.ok) throw new Error('send failed');
      const data = await response.json();
      setOrderId(data.id);
    } catch {
      setOrderStatus('draft');
      setCartOpen(true);
      flash('Échec de l’envoi, réessayez');
    }
  }

  // Suit en direct le statut de la commande envoyée (acceptée / refusée par un serveur)
  useEffect(() => {
    if (!orderId) return undefined;
    const source = new EventSource('/api/stream');
    source.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'order' && message.order.id === orderId) {
        if (message.order.status === 'accepted') { setOrderStatus('accepted'); flash('Votre commande a été acceptée'); }
        if (message.order.status === 'rejected') { setOrderStatus('rejected'); }
      }
    };
    return () => source.close();
  }, [orderId]);

  function resetDemo() {
    setOrderStatus('draft');
    setOrderId(null);
    setCartOpen(false);
    setSelected(null);
  }

  return (
    <div className="app-shell">
      <header className="demo-header">
        <button className="brand" aria-label="Accueil ClickOne"><span>C.O</span></button>
        <button className="table-pill">Table {TABLE} <span>⌄</span></button>
      </header>

      <main className="client-view">
        {orderStatus !== 'draft' && <OrderStatus status={orderStatus} onReset={resetDemo} />}
        <div className="search-row"><label className="search-box"><MagnifyingGlass size={24} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un plat, ingrédient…" />{search && <button onClick={() => setSearch('')} aria-label="Effacer"><X size={18} /></button>}</label><button className="filter-button" aria-label="Filtres"><SlidersHorizontal size={25} /></button></div>
        <nav className="category-strip" aria-label="Catégories">{CATEGORIES.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <section className="product-grid" aria-label="Produits">{visibleProducts.map((product) => <article className="product" key={product.id}>
          <button className="product-visual" onClick={() => { setSelected(product); setRotation(0); }} aria-label={`Voir ${product.name} en 360 degrés`}><img src={product.image} alt={product.name} /><span className="view-360"><Sparkle size={14} weight="fill" /> 360°</span></button>
          <div className="product-copy"><button onClick={() => { setSelected(product); setRotation(0); }}><h2>{product.name}</h2></button>{product.size && <span className="product-size">{product.size}</span>}<div className="product-line"><span>{money(product.price)}</span>{cart[product.id] ? <div className="mini-stepper"><button onClick={() => changeQuantity(product, -1)} aria-label="Retirer"><Minus /></button><strong>{cart[product.id]}</strong><button onClick={() => changeQuantity(product, 1)} aria-label="Ajouter"><Plus /></button></div> : <button className="quick-add" onClick={() => add(product)} aria-label={`Ajouter ${product.name}`}><Plus weight="bold" /></button>}</div></div>
        </article>)}</section>
        {!visibleProducts.length && <div className="empty-state">Aucun produit ne correspond à votre recherche.</div>}
        {itemCount > 0 && orderStatus === 'draft' && <button className="cart-bar" onClick={() => setCartOpen(true)}><span className="cart-count">{itemCount}</span><span>Voir ma commande</span><strong>{money(total)}</strong></button>}
      </main>

      {selected && <div className="overlay" role="dialog" aria-modal="true" aria-label={selected.name}>
        <button className="overlay-backdrop" onClick={() => setSelected(null)} aria-label="Fermer" />
        <section className="product-sheet"><div className="sheet-topline"><button className="icon-button" onClick={() => setSelected(null)} aria-label="Retour"><ArrowLeft size={22} /></button><span>Vue 360°</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="Fermer"><X size={22} /></button></div>
          <div className="rotate-stage" onPointerDown={(event) => { dragStart.current = { x: event.clientX, rotation }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragStart.current) setRotation(dragStart.current.rotation + (event.clientX - dragStart.current.x) * .7); }} onPointerUp={() => { dragStart.current = null; }}>
            <img src={selected.image} alt={selected.name} style={{ transform: `perspective(800px) rotateY(${rotation}deg)` }} draggable="false" /><p>Glissez pour tourner le plat</p>
          </div>
          <div className="sheet-copy"><p className="eyebrow">{selected.sourceCategory || selected.category}</p><h2>{selected.name}</h2><p>{selected.description}{selected.size ? ` · ${selected.size}` : ''}</p><div className="sheet-action"><strong>{money(selected.price)}</strong><button className="primary-button" onClick={() => { add(selected); setSelected(null); }} disabled={orderStatus !== 'draft'}><Plus size={20} weight="bold" /> Ajouter</button></div></div>
        </section>
      </div>}

      {cartOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Votre commande"><button className="overlay-backdrop" onClick={() => setCartOpen(false)} aria-label="Fermer" /><section className="cart-sheet">
        <div className="sheet-topline"><div><p className="eyebrow">Table {TABLE}</p><h2>Votre commande</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Fermer"><X size={22} /></button></div>
        <div className="cart-lines">{lines.map((line) => <div className="cart-line" key={line.id}><img src={line.image} alt="" /><div><strong>{line.name}</strong><span>{money(line.price)}</span></div><div className="mini-stepper"><button onClick={() => changeQuantity(line, -1)} aria-label="Retirer">{line.quantity === 1 ? <Trash /> : <Minus />}</button><strong>{line.quantity}</strong><button onClick={() => changeQuantity(line, 1)} aria-label="Ajouter"><Plus /></button></div></div>)}</div>
        <div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div><button className="send-button" onClick={sendOrder}><BellRinging size={22} weight="fill" /> Envoyer aux serveurs</button><p className="payment-note">Aucun paiement maintenant. Vous réglerez en partant.</p>
      </section></div>}
      {toast && <div className="toast"><CheckCircle weight="fill" /> {toast}</div>}
    </div>
  );
}

function OrderStatus({ status, onReset }) {
  const data = { pending: [<Clock weight="fill" />, 'Commande envoyée', 'Un serveur va confirmer votre commande.'], accepted: [<CheckCircle weight="fill" />, 'Votre commande est prise !', 'Le ticket vient d’être envoyé au bar.'], rejected: [<XCircle weight="fill" />, 'Commande non disponible', 'Veuillez modifier votre sélection ou appeler un serveur.'] }[status];
  return <section className={`status-banner ${status}`}><div className="status-icon">{data[0]}</div><div><strong>{data[1]}</strong><span>{data[2]}</span></div>{status === 'rejected' && <button onClick={onReset}>Recommencer</button>}</section>;
}
