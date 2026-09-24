import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const money = amount => 'GH₵' + Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function icon(type) {
  return ({ base: '◒', sauce: '◉', cheese: '✦', vegetable: '✿' })[type] || '🍕';
}

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Razorpay checkout.'));
    document.body.appendChild(s);
  });
}

const SIGNATURE_PIZZAS = [
  {
    title: 'Tema Classic',
    image: '/images/azizpiz-heart-board.jpeg',
    emoji: '🍕',
    description: 'Aziz Classic Crust, rich tomato sauce, melty mozzarella and black olives.',
    preset: { base: 'Aziz Classic Crust', sauce: 'Rich Tomato', cheese: 'Mozzarella', vegetables: ['Black Olives'] }
  },
  {
    title: 'Tema Garden',
    image: '/images/azizpiz-garden.jpeg',
    emoji: '🫑',
    description: 'Crisp thin crust with green pesto, mozzarella, green pepper, mushrooms and sweet corn.',
    preset: { base: 'Thin & Crispy', sauce: 'Green Pesto', cheese: 'Mozzarella', vegetables: ['Green Pepper', 'Mushrooms', 'Sweet Corn'] }
  },
  {
    title: 'Aziz Cheese Burst',
    image: '/images/azizpiz-cheese-pull.jpeg',
    emoji: '🧀',
    description: 'Stuffed crust smothered in creamy garlic sauce and rich cheddar blend.',
    preset: { base: 'Stuffed Crust', sauce: 'Creamy Garlic', cheese: 'Cheddar Blend', vegetables: ['Fresh Chilli'] }
  },
  {
    title: 'Shito Fire BBQ',
    image: '/images/azizpiz-wood-fired.jpeg',
    emoji: '🔥',
    description: 'Aziz Classic dough with smoky barbecue sauce, mozzarella, red onion and fresh chilli.',
    preset: { base: 'Aziz Classic Crust', sauce: 'Smoky BBQ', cheese: 'Mozzarella', vegetables: ['Red Onion', 'Fresh Chilli'] }
  },
  {
    title: 'Tema Green Vegan',
    image: '/images/azizpiz-hero.jpeg',
    emoji: '🌿',
    description: 'Whole wheat crust, shito spice, plant-based cheese and a bright garden of vegetables.',
    preset: { base: 'Whole Wheat', sauce: 'Shito Spice', cheese: 'Plant-Based Cheese', vegetables: ['Green Pepper', 'Red Onion', 'Mushrooms', 'Black Olives'] }
  },
  {
    title: 'Creamy Tema Harvest',
    image: '/images/azizpiz-heart-love.jpeg',
    emoji: '🍄',
    description: 'Thin & crispy crust with creamy garlic, mozzarella, mushrooms and sweet corn.',
    preset: { base: 'Thin & Crispy', sauce: 'Creamy Garlic', cheese: 'Mozzarella', vegetables: ['Mushrooms', 'Sweet Corn'] }
  }
];

function Builder({ catalog, session, initialSelections, onClose, onOrdered, navigate }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(initialSelections || { vegetables: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSelections) setSelected(initialSelections);
  }, [initialSelections]);

  const steps = [
    { key: 'base', title: 'Pick your canvas', text: 'The foundation of a really great pizza.' },
    { key: 'sauce', title: 'Set the tone', text: 'Sauce is where personality begins.' },
    { key: 'cheese', title: 'Make it melt', text: 'Go classic or take the scenic route.' },
    { key: 'vegetable', title: 'Bring the color', text: 'Choose as many fresh toppings as you like.' }
  ];

  const current = steps[step];
  const choices = catalog.filter(x => x.category === current.key && x.quantity > 0);
  const ids = [selected.base, selected.sauce, selected.cheese, ...(selected.vegetables || [])].filter(Boolean);
  const total = catalog.filter(x => ids.includes(x._id)).reduce((sum, x) => sum + x.price, 0);

  const choose = id => {
    if (current.key === 'vegetable') {
      setSelected(x => ({
        ...x,
        vegetables: (x.vegetables || []).includes(id)
          ? x.vegetables.filter(v => v !== id)
          : [...(x.vegetables || []), id]
      }));
    } else {
      setSelected(x => ({ ...x, [current.key]: id }));
      if (step < 3) setStep(step + 1);
    }
  };

  const checkout = async () => {
    if (!session) return navigate('/login');
    setBusy(true);
    setError('');
    try {
      const check = await request('/orders/checkout', {
        token: session.token,
        method: 'POST',
        body: JSON.stringify({ selections: selected })
      });

      const verify = async payload => {
        await request('/orders/verify', {
          token: session.token,
          method: 'POST',
          body: JSON.stringify({ provider: check.mode, intentId: check.intentId, ...payload })
        });
        onOrdered();
      };

      if (check.mode === 'test') {
        if (confirm(`Development Test Checkout: ${money(check.amount)}.\n\nSimulate payment authorization now?`)) {
          await verify({});
        } else {
          setBusy(false);
        }
        return;
      }

      await loadRazorpay();
      new window.Razorpay({
        key: check.key,
        amount: check.amount,
        currency: check.currency,
        name: 'Azizpiz',
        description: 'Your custom pizza',
        order_id: check.orderId,
        handler: verify,
        theme: { color: '#ee592b' }
      }).open();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="builder">
      <div className="builder-top">
        <button className="link" onClick={onClose}>← Back to menu</button>
        <div className="mini-total">YOUR PIZZA <b>{money(total)}</b></div>
      </div>
      <div className="stepper">
        {steps.map((x, i) => (
          <button
            className={i === step ? 'active' : i < step ? 'complete' : ''}
            onClick={() => setStep(i)}
            key={x.key}
          >
            <span>{i + 1}</span>{x.key}
          </button>
        ))}
      </div>
      <section className="builder-grid">
        <div>
          <p className="eyebrow">STEP {step + 1} OF 4</p>
          <h1>{current.title}</h1>
          <p className="muted">{current.text}</p>
          <div className="options">
            {choices.map(item => {
              const yes = current.key === 'vegetable'
                ? (selected.vegetables || []).includes(item._id)
                : selected[current.key] === item._id;
              return (
                <button
                  className={`option ${yes ? 'chosen' : ''}`}
                  onClick={() => choose(item._id)}
                  key={item._id}
                >
                  <span>{icon(current.key)}</span>
                  <div>
                    <b>{item.name}</b>
                    <small>{item.quantity} portions available</small>
                  </div>
                  <em>{item.price ? `+${money(item.price)}` : 'Included'}</em>
                  <i>{yes ? '✓' : '+'}</i>
                </button>
              );
            })}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="builder-actions">
            <button className="outline" disabled={!step} onClick={() => setStep(step - 1)}>Back</button>
            {step < 3 ? (
              <button
                className="primary"
                disabled={!selected[current.key]}
                onClick={() => setStep(step + 1)}
              >
                Continue →
              </button>
            ) : (
              <button
                className="primary"
                disabled={!selected.base || !selected.sauce || !selected.cheese || busy}
                onClick={checkout}
              >
                {busy ? 'Opening checkout…' : `Review & pay ${money(total)}`}
              </button>
            )}
          </div>
        </div>
        <aside className="summary">
          <p className="eyebrow">YOUR MASTERPIECE</p>
          <div className="pizza-preview">🍕</div>
          {steps.slice(0, 3).map(x => (
            <p key={x.key}>
              <span>{x.key}</span>
              {catalog.find(i => i._id === selected[x.key])?.name || 'Not chosen yet'}
            </p>
          ))}
          <p>
            <span>toppings</span>
            {(selected.vegetables || []).length
              ? selected.vegetables.map(id => catalog.find(x => x._id === id)?.name).filter(Boolean).join(', ')
              : 'Keep it simple'}
          </p>
          <hr />
          <h3>Total <b>{money(total)}</b></h3>
          <small>Taxes and delivery included. Fast checkout.</small>
        </aside>
      </section>
    </main>
  );
}

function Admin({ session, onBack }) {
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('orders');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [i, o] = await Promise.all([
        request('/admin/inventory', { token: session.token }),
        request('/admin/orders', { token: session.token })
      ]);
      setInventory(i);
      setOrders(o);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const update = async (id, body) => {
    try {
      await request(`/admin/inventory/${id}`, {
        token: session.token,
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const status = async (id, value) => {
    try {
      await request(`/admin/orders/${id}/status`, {
        token: session.token,
        method: 'PATCH',
        body: JSON.stringify({ status: value })
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const low = inventory.filter(x => x.quantity <= x.lowStockThreshold);

  return (
    <main className="admin">
      <section className="admin-hero">
        <div>
          <button className="link" onClick={onBack} style={{ marginBottom: 12 }}>← Back to Storefront</button>
          <p className="eyebrow">AZIZPIZ OPERATIONS · TEMA</p>
          <h1>Good morning, chef.</h1>
          <p>Here’s what needs your kitchen attention today.</p>
        </div>
        <div className="metrics">
          <div><b>{orders.length}</b><span>orders placed</span></div>
          <div className={low.length ? 'alert' : ''}><b>{low.length}</b><span>low-stock alerts</span></div>
        </div>
      </section>
      <div className="tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          Order queue <span>{orders.length}</span>
        </button>
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>
          Inventory <span>{low.length} alert</span>
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {tab === 'orders' ? (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">LIVE ORDER QUEUE</p>
              <h2>Incoming orders</h2>
            </div>
            <small>Auto-refreshes every 10 seconds</small>
          </div>
          {orders.length ? (
            orders.map(o => (
              <article className="admin-order" key={o._id}>
                <div className="order-id">
                  <b>#{o._id.slice(-6).toUpperCase()}</b>
                  <small>{new Date(o.createdAt).toLocaleString()}</small>
                </div>
                <div>
                  <strong>{o.customer?.name || 'Customer'}</strong>
                  <small>{o.customer?.email}</small>
                  <p>{o.items.map(x => x.name).join(' · ')}</p>
                </div>
                <b>{money(o.amount)}</b>
                <select value={o.status} onChange={e => status(o._id, e.target.value)}>
                  {['Order Received', 'In Kitchen', 'Sent to Delivery'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </article>
            ))
          ) : (
            <div className="empty">The queue is clear. Time to prep the dough.</div>
          )}
        </section>
      ) : (
        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">STOCK CONTROL</p>
              <h2>Inventory at a glance</h2>
            </div>
            <small>Items at or below threshold appear highlighted.</small>
          </div>
          <div className="inventory-grid">
            {['base', 'sauce', 'cheese', 'vegetable'].map(category => (
              <div className="inventory-group" key={category}>
                <h3>{category}s</h3>
                {inventory.filter(x => x.category === category).map(item => (
                  <div className={`stock ${item.quantity <= item.lowStockThreshold ? 'low' : ''}`} key={item._id}>
                    <div>
                      <b>{item.name}</b>
                      <small>Threshold: {item.lowStockThreshold} | {money(item.price)}</small>
                    </div>
                    <label>Qty
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={e => setInventory(list => list.map(x => x._id === item._id ? { ...x, quantity: e.target.value } : x))}
                        onBlur={e => update(item._id, { quantity: Number(e.target.value) })}
                      />
                    </label>
                    <label>Alert
                      <input
                        type="number"
                        min="0"
                        value={item.lowStockThreshold}
                        onChange={e => setInventory(list => list.map(x => x._id === item._id ? { ...x, lowStockThreshold: e.target.value } : x))}
                        onBlur={e => update(item._id, { lowStockThreshold: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function AuthView({ view, navigate, onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devLink, setDevLink] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setInfo('');
    setDevLink('');
    setBusy(true);

    try {
      if (view === 'login') {
        const res = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        onLoggedIn(res);
        navigate('/');
      } else if (view === 'register') {
        const res = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        setInfo(res.message);
        if (res.verificationUrl) {
          setDevLink(res.verificationUrl);
        }
      } else if (view === 'forgot-password') {
        const res = await request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        setInfo(res.message);
        if (res.resetUrl) {
          setDevLink(res.resetUrl);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <button className="link" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>← Back to Azizpiz</button>
        {view === 'login' && (
          <>
            <p className="eyebrow">WELCOME TO AZIZPIZ</p>
            <h1>Pizza from Tema, made easy.</h1>
            <p className="muted">Sign in to track your hot order from our kitchen to your door.</p>
            {error && <p className="error">{error}</p>}
            {info && <p className="success">{info}</p>}
            <form onSubmit={handleSubmit}>
              <label>Email address
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label>Password
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </label>
              <button type="submit" className="primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
            </form>
            <div className="bottom">
              <button className="link" onClick={() => navigate('/register')}>Don’t have an account? Register</button>
              <br />
              <button className="link" onClick={() => navigate('/forgot-password')}>Forgot password?</button>
            </div>
            <div className="staff-link">
              Azizpiz team account: <b>admin@azizpiz.local</b> / <b>ChangeMe123!</b>
            </div>
          </>
        )}

        {view === 'register' && (
          <>
            <p className="eyebrow">NEW AZIZPIZ MEMBER</p>
            <h1>Create account</h1>
            <p className="muted">Join the Azizpiz family, build your pizza and track delivery to your door.</p>
            {error && <p className="error">{error}</p>}
            {info && (
              <div className="success">
                <p>{info}</p>
                {devLink && (
                  <div style={{ marginTop: 10 }}>
                    <a href={devLink} className="primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Verify Account Now (Dev Mode) →
                    </a>
                  </div>
                )}
              </div>
            )}
            {!info && (
              <form onSubmit={handleSubmit}>
                <label>Your Name
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Marco Polo" />
                </label>
                <label>Email address
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label>Password (min 8 characters)
                  <input type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </label>
                <button type="submit" className="primary wide" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
              </form>
            )}
            <div className="bottom">
              <button className="link" onClick={() => navigate('/login')}>Already have an account? Sign in</button>
            </div>
          </>
        )}

        {view === 'forgot-password' && (
          <>
            <p className="eyebrow">ACCOUNT RECOVERY</p>
            <h1>Reset password</h1>
            <p className="muted">Enter your email and we’ll send a link to reset your password.</p>
            {error && <p className="error">{error}</p>}
            {info && (
              <div className="success">
                <p>{info}</p>
                {devLink && (
                  <div style={{ marginTop: 10 }}>
                    <a href={devLink} className="primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                      Set New Password (Dev Link) →
                    </a>
                  </div>
                )}
              </div>
            )}
            {!info && (
              <form onSubmit={handleSubmit}>
                <label>Email address
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <button type="submit" className="primary wide" disabled={busy}>{busy ? 'Sending link…' : 'Send Reset Link'}</button>
              </form>
            )}
            <div className="bottom">
              <button className="link" onClick={() => navigate('/login')}>← Back to Sign in</button>
            </div>
          </>
        )}
      </div>
      <div className="auth-art">
        <p>TEMA’S PIZZA PEOPLE</p>
        <div className="pizza-orb">🍕</div>
      </div>
    </div>
  );
}

function ResetPasswordView({ token, navigate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <div className="panel">
        <p className="eyebrow">PASSWORD RESET</p>
        <h2>Set a new password</h2>
        {done ? (
          <div>
            <p className="success">Password updated successfully!</p>
            <button className="primary" onClick={() => navigate('/login')}>Sign in now →</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error">{error}</p>}
            <label>New Password (min 8 characters)
              <input type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <button type="submit" className="primary wide" disabled={busy}>{busy ? 'Updating…' : 'Save new password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function VerifyEmailView({ token, navigate }) {
  const [status, setStatus] = useState('Verifying your email address…');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('Invalid or missing verification token.');
      return;
    }
    request(`/auth/verify-email/${token}`)
      .then(res => {
        setStatus(res.message || 'Email verified successfully!');
        setVerified(true);
      })
      .catch(e => {
        setStatus(e.message || 'Verification link expired or invalid.');
      });
  }, [token]);

  return (
    <div className="center">
      <div className="panel">
        <p className="eyebrow">EMAIL CONFIRMATION</p>
        <h2>Account Verification</h2>
        <p className={verified ? 'success' : 'muted'}>{status}</p>
        <button className="primary" onClick={() => navigate('/login')}>
          {verified ? 'Continue to Sign in →' : 'Back to Login'}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('pizzaro_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [route, setRoute] = useState(window.location.pathname);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [building, setBuilding] = useState(false);
  const [builderPreset, setBuilderPreset] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const navigate = path => {
    window.history.pushState({}, '', path);
    setRoute(path.split('?')[0]);
  };

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadCatalog = async () => {
    try {
      const data = await request('/catalog');
      setCatalog(data);
    } catch (e) {
      console.error('Failed to load catalog:', e);
    }
  };

  const loadOrders = async () => {
    if (!session?.token) return;
    try {
      const data = await request('/orders/my', { token: session.token });
      setOrders(data);
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (session) {
      loadOrders();
      const id = setInterval(loadOrders, 10000);
      return () => clearInterval(id);
    } else {
      setOrders([]);
    }
  }, [session]);

  const handleLogin = authData => {
    setSession(authData);
    localStorage.setItem('pizzaro_session', JSON.stringify(authData));
    showToast(`Welcome back, ${authData.user.name}!`);
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('pizzaro_session');
    showToast('Signed out successfully.');
    navigate('/');
  };

  const startSignature = pizza => {
    if (!catalog.length) return;
    const baseItem = catalog.find(x => x.category === 'base' && x.name === pizza.preset.base);
    const sauceItem = catalog.find(x => x.category === 'sauce' && x.name === pizza.preset.sauce);
    const cheeseItem = catalog.find(x => x.category === 'cheese' && x.name === pizza.preset.cheese);
    const vegIds = pizza.preset.vegetables
      .map(vName => catalog.find(x => x.category === 'vegetable' && x.name === vName)?._id)
      .filter(Boolean);

    setBuilderPreset({
      base: baseItem?._id || '',
      sauce: sauceItem?._id || '',
      cheese: cheeseItem?._id || '',
      vegetables: vegIds
    });
    setBuilding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('token');

  return (
    <div>
      {toast && <div className="toast">{toast}</div>}
      <header>
        <div className="brand" onClick={() => { setBuilding(false); navigate('/'); }} style={{ cursor: 'pointer' }}>
          Aziz<span>piz</span><i>●</i>
        </div>
        <nav>
          <button className="link" onClick={() => { setBuilding(false); navigate('/'); }}>Menu</button>
          {session?.user?.role === 'admin' && (
            <button className="link" onClick={() => { setBuilding(false); navigate('/admin'); }}>Kitchen Desk</button>
          )}
          {session ? (
            <>
              <span className="hello">Hi, {session.user.name.split(' ')[0]}</span>
              {orders.length > 0 && (
                <button
                  className="link"
                  onClick={() => {
                    setBuilding(false);
                    navigate('/');
                    setTimeout(() => {
                      document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  }}
                >
                  My Orders ({orders.length})
                </button>
              )}
              <button className="outline" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button className="outline" onClick={() => navigate('/login')}>Sign in</button>
          )}
          <button
            className="primary"
            onClick={() => {
              setBuilderPreset(null);
              setBuilding(true);
              navigate('/');
            }}
          >
            Order Now <span>+</span>
          </button>
        </nav>
      </header>

      {route === '/admin' && session?.user?.role === 'admin' ? (
        <Admin session={session} onBack={() => navigate('/')} />
      ) : route === '/login' ? (
        <AuthView view="login" navigate={navigate} onLoggedIn={handleLogin} />
      ) : route === '/register' ? (
        <AuthView view="register" navigate={navigate} onLoggedIn={handleLogin} />
      ) : route === '/forgot-password' ? (
        <AuthView view="forgot-password" navigate={navigate} onLoggedIn={handleLogin} />
      ) : route === '/reset-password' ? (
        <ResetPasswordView token={tokenParam} navigate={navigate} />
      ) : route === '/verify-email' ? (
        <VerifyEmailView token={tokenParam} navigate={navigate} />
      ) : building ? (
        <Builder
          catalog={catalog}
          session={session}
          initialSelections={builderPreset}
          onClose={() => setBuilding(false)}
          onOrdered={() => {
            setBuilding(false);
            showToast('Order confirmed! We are prepping your dough now.');
            loadOrders();
            loadCatalog();
            setTimeout(() => {
              document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          navigate={navigate}
        />
      ) : (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">AZIZPIZ · TEMA, GHANA</p>
              <h1>Tema’s slice of <i>happy.</i></h1>
              <p>Fresh dough, big flavour and pizza made for sharing. Build your own or choose an Azizpiz favourite.</p>
              <button
                className="primary"
                onClick={() => {
                  setBuilderPreset(null);
                  setBuilding(true);
                }}
              >
                Order your pizza <span>→</span>
              </button>
            </div>
            <div className="hero-pizza">
              <div>🍕</div>
              <small>FRESH<br />IN TEMA</small>
            </div>
          </section>

          <section className="section-head">
            <h2>Tema Favourites</h2>
            <span>Big flavour, made the Azizpiz way</span>
          </section>

          <div className="cards">
            {SIGNATURE_PIZZAS.map(pizza => (
              <article className="pizza-card" key={pizza.title}>
                <img className="food" src={pizza.image} alt={`${pizza.title} pizza`} />
                <h3>{pizza.title}</h3>
                <p>{pizza.description}</p>
                <button onClick={() => startSignature(pizza)}>Customize & Order →</button>
              </article>
            ))}
          </div>

          <section className="orders" id="orders">
            <div className="section-head">
              <h2>Your Azizpiz Orders</h2>
              <span>Live kitchen tracking from Tema</span>
            </div>
            {orders.length ? (
              orders.map(o => (
                <article className="order-row" key={o._id}>
                  <div>
                    <b>#{o._id.slice(-6).toUpperCase()}</b>
                    <small>{new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <div>
                    <p>{o.items.map(x => x.name).join(' · ')}</p>
                    <div className="progress">
                      <span className={o.status === 'Order Received' ? 'current' : 'done'}>Order Received</span>
                      <span className={o.status === 'In Kitchen' ? 'current kitchen' : o.status === 'Sent to Delivery' ? 'done' : ''}>In Kitchen</span>
                      <span className={o.status === 'Sent to Delivery' ? 'current delivery' : ''}>Sent to Delivery</span>
                    </div>
                  </div>
                  <div>
                    <b>{money(o.amount)}</b>
                    <small>{o.payment?.provider === 'test' ? 'Test Payment' : 'Razorpay'}</small>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">
                {session
                  ? 'You have no recent orders. Build your custom masterpiece above!'
                  : 'Sign in to view your real-time pizza tracking and orders history.'}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
