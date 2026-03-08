// ── app.js ─────────────────────────────────────────────────────────────────────
import {
  selFlavor1, selFlavor2, selTubType, qty1, qty2,
  setSelFlavor1, setSelFlavor2, setSelTubType, setQty1, setQty2,
  setAnalyticsYear, setAnalyticsMonth,
  currentUser, setCurrentUser,
  accountType, setAccountType,
  selCustomerType, setSelCustomerType,
} from './state.js';
import {
  FLAVORS, ACCOUNT_TYPE_RESELLER, ACCOUNT_TYPE_SELLER, flavorPrice,
  todayKey, monthKey, setDateHeader, showToast, setSyncStatus,
} from './utils.js';
import {
  startOrdersListener, startDaysListener, stopListeners,
  addOrderToFirestore, saveDayToFirestore,
} from './firebase.js';
import { renderAnalytics } from './analytics.js';
import { todayOrders } from './render.js';
import { watchAuth, login, logout, register } from './auth.js';

// ── Auth flow ──────────────────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  stopListeners();
}

function showApp(user, type) {
  setCurrentUser(user);
  setAccountType(type || ACCOUNT_TYPE_RESELLER);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('loading').classList.remove('hidden');  // show while Firestore connects

  document.getElementById('user-display-name').textContent = user.displayName || user.email;

  // Show account type badge in header
  const badge = document.getElementById('account-type-badge');
  if (badge) {
    badge.textContent  = accountType === ACCOUNT_TYPE_SELLER ? '🏪 Seller' : '🔄 Reseller';
    badge.className    = `account-badge ${accountType}`;
  }

  // Hide profit column entirely for Seller accounts
  applyAccountTypeUI();

  initApp();
}

function applyAccountTypeUI() {
  const isSeller = accountType === ACCOUNT_TYPE_SELLER;
  // Hide profit stat card on Add tab
  document.querySelectorAll('.stat.profit').forEach(el => el.style.display = isSeller ? 'none' : '');
  // Hide profit column in summary for seller
  document.getElementById('sum-profit-wrap')?.style && (
    document.getElementById('sum-profit-wrap').style.display = isSeller ? 'none' : ''
  );
}

window.doLogin = async function() {
  const email = document.getElementById('auth-email').value.trim();
  const pw    = document.getElementById('auth-pw').value;
  const err   = document.getElementById('auth-error');
  err.textContent = '';
  if (!email || !pw) { err.textContent = 'Please enter email and password.'; return; }
  setAuthLoading(true);
  try {
    await login(email, pw);
  } catch (e) {
    err.textContent = friendlyAuthError(e.code);
    setAuthLoading(false);
  }
};

window.doRegister = async function() {
  const name  = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email-reg').value.trim();
  const pw    = document.getElementById('auth-pw2-new').value;
  const pw2   = document.getElementById('auth-pw2').value;
  const type  = document.getElementById('auth-account-type').value;
  const err   = document.getElementById('auth-error');
  err.textContent = '';
  if (!name)         { err.textContent = 'Please enter your name.'; return; }
  if (!email || !pw) { err.textContent = 'Please enter email and password.'; return; }
  if (pw !== pw2)    { err.textContent = 'Passwords do not match.'; return; }
  if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  setAuthLoading(true);
  try {
    await register(name, email, pw, type);
  } catch (e) {
    err.textContent = friendlyAuthError(e.code);
    setAuthLoading(false);
  }
};

window.doLogout = async function() {
  await logout();
  setCurrentUser(null);
  setAccountType(null);
};

window.showRegisterForm = function() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('auth-error').textContent = '';
};

window.showLoginForm = function() {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('auth-error').textContent = '';
};

window.authKeydown = function(e) {
  if (e.key !== 'Enter') return;
  const regForm = document.getElementById('register-form');
  if (regForm.classList.contains('hidden')) window.doLogin();
  else window.doRegister();
};

function setAuthLoading(on) {
  const lb = document.getElementById('auth-login-btn');
  const rb = document.getElementById('auth-register-btn');
  if (lb) { lb.disabled = on; lb.textContent = on ? 'Signing in…'       : 'Sign In'; }
  if (rb) { rb.disabled = on; rb.textContent = on ? 'Creating account…' : 'Create Account'; }
}

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'That email is already registered.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':    return 'Too many attempts. Try again later.';
    default: return 'Something went wrong. Please try again.';
  }
}

// ── App init ───────────────────────────────────────────────────────────────────

function initApp() {
  const now = new Date();
  setAnalyticsYear(now.getFullYear());
  setAnalyticsMonth(now.getMonth());
  setSelCustomerType('normal'); // reset to normal on each login

  setDateHeader();
  buildFlavorGrids();
  updateCustomerTypeUI();
  startOrdersListener(currentUser.uid);
  startDaysListener(currentUser.uid);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Customer type toggle (per order) ──────────────────────────────────────────

window.setCustomerType = function(type) {
  setSelCustomerType(type);
  updateCustomerTypeUI();
  updatePreview();
};

function updateCustomerTypeUI() {
  const btnNormal   = document.getElementById('ctype-normal');
  const btnReseller = document.getElementById('ctype-reseller');
  if (!btnNormal) return;
  btnNormal.classList.toggle('ctype-active', selCustomerType === 'normal');
  btnReseller.classList.toggle('ctype-active', selCustomerType === 'reseller');

  // Update price tags on flavor buttons to reflect current customer type
  document.querySelectorAll('.flavor-btn[data-flavor]').forEach(btn => {
    const f = FLAVORS.find(f => f.name === btn.dataset.flavor);
    if (!f) return;
    const tag = btn.querySelector('.price-tag');
    if (tag) tag.textContent = `₱${flavorPrice(f, selCustomerType)}`;
  });
}

// ── Flavor selection ───────────────────────────────────────────────────────────

function buildFlavorGrids() {
  ['flavor1-grid', 'flavor2-grid'].forEach(id => document.getElementById(id).innerHTML = '');
  ['flavor1-grid', 'flavor2-grid'].forEach((id, isF2) => {
    const grid = document.getElementById(id);
    FLAVORS.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'flavor-btn';
      btn.innerHTML = `${f.name}<span class="price-tag">₱${flavorPrice(f, selCustomerType)}</span>`;
      btn.onclick = () => selectFlavor(f.name, !!isF2);
      btn.dataset.flavor = f.name;
      btn.dataset.which  = isF2 ? '2' : '1';
      grid.appendChild(btn);
    });
  });
}

function selectFlavor(name, isF2) {
  if (isF2) {
    setSelFlavor2(selFlavor2 === name ? null : name);
  } else {
    setSelFlavor1(selFlavor1 === name ? null : name);
    setSelFlavor2(null);
  }
  updateFlavorUI();
  updatePreview();
}

function updateFlavorUI() {
  document.querySelectorAll('[data-which="1"]').forEach(b =>
    b.className = 'flavor-btn' + (b.dataset.flavor === selFlavor1 ? ' selected' : ''));
  document.querySelectorAll('[data-which="2"]').forEach(b =>
    b.className = 'flavor-btn' + (b.dataset.flavor === selFlavor2 ? ' selected-2' : ''));
  const show2 = selTubType === 2 && selFlavor1;
  document.getElementById('mixed-hint').className        = 'mixed-hint' + (show2 ? ' show' : '');
  document.getElementById('flavor2-field').style.display = show2 ? 'block' : 'none';
  // Re-apply price tags after class reset
  updateCustomerTypeUI();
}

// ── Tub type / qty ─────────────────────────────────────────────────────────────

function selectTubType(type) {
  setSelTubType(selTubType === type ? null : type);
  if (selTubType !== 2) setSelFlavor2(null);
  updateTubUI(); updateFlavorUI(); updatePreview();
}

function changeQty(type, delta) {
  if (type === 1) setQty1(Math.max(1, qty1 + delta));
  else            setQty2(Math.max(1, qty2 + delta));
  updateTubUI(); updatePreview();
}

function updateTubUI() {
  document.getElementById('tub-opt-1')?.classList.toggle('active-tub', selTubType === 1);
  document.getElementById('tub-opt-2')?.classList.toggle('active-tub', selTubType === 2);
  document.getElementById('tub-btn-1')?.classList.toggle('sel', selTubType === 1);
  document.getElementById('tub-btn-2')?.classList.toggle('sel', selTubType === 2);
  const q1el = document.getElementById('qty-1'); if (q1el) q1el.textContent = qty1;
  const q2el = document.getElementById('qty-2'); if (q2el) q2el.textContent = qty2;
  const m1   = document.getElementById('minus-1'); if (m1) m1.disabled = qty1 <= 1;
  const m2   = document.getElementById('minus-2'); if (m2) m2.disabled = qty2 <= 1;
}

// ── Order preview ──────────────────────────────────────────────────────────────

function updatePreview() {
  const preview  = document.getElementById('order-preview');
  const addBtn   = document.getElementById('add-btn');
  const customer = document.getElementById('customer-name').value.trim();
  const isSeller = accountType === ACCOUNT_TYPE_SELLER;

  if (!selFlavor1 || !selTubType) {
    preview.innerHTML = '<span>Select flavor &amp; tub size above…</span>';
    addBtn.disabled = true;
    return;
  }

  const isMixed    = selTubType === 2 && selFlavor2;
  const qty        = selTubType === 1 ? qty1 : qty2;
  const f1         = FLAVORS.find(f => f.name === selFlavor1);
  const f2         = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
  const p1         = flavorPrice(f1, selCustomerType);
  const p2         = f2 ? flavorPrice(f2, selCustomerType) : 0;
  const tubRevenue = isMixed ? p1 + p2 : selTubType * p1;
  const tubProfit  = isSeller ? null :
    isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost);
  const totalRevenue = tubRevenue * qty;
  const totalProfit  = tubProfit !== null ? tubProfit * qty : null;
  const totalPieces  = selTubType * qty;
  const flavorLabel  = isMixed ? `${selFlavor1} + ${selFlavor2}` : selFlavor1;
  const tubLabel     = `${qty} × ${selTubType}pc tub${qty > 1 ? 's' : ''}`;
  const ctypeBadge   = selCustomerType === 'reseller'
    ? `<span class="ctype-tag reseller-tag">🔄 Reseller price</span>`
    : `<span class="ctype-tag normal-tag">👤 Normal price</span>`;
  const cHTML = customer ? `<span style="color:var(--amber);font-size:10px;display:block;margin-top:2px">👤 ${customer}</span>` : '';

  preview.innerHTML = `
    <span class="preview-text">
      <strong>${flavorLabel}</strong><br>
      <span style="font-size:10px;color:var(--muted)">${tubLabel} = ${totalPieces} pc total</span>
      ${ctypeBadge}
      ${cHTML}
    </span>
    <span class="preview-price">
      ₱${totalRevenue}
      ${totalProfit !== null ? `<div style="font-size:9px;color:var(--green);font-weight:400">+₱${totalProfit} profit</div>` : ''}
      ${qty > 1 ? `<div class="preview-breakdown">₱${tubRevenue}/tub</div>` : ''}
    </span>`;
  addBtn.disabled = false;
}

// ── Add order ──────────────────────────────────────────────────────────────────

async function addOrder() {
  if (!selFlavor1 || !selTubType || !currentUser) return;
  const btn = document.getElementById('add-btn');
  btn.disabled = true;

  const isSeller   = accountType === ACCOUNT_TYPE_SELLER;
  const isMixed    = selTubType === 2 && selFlavor2;
  const qty        = selTubType === 1 ? qty1 : qty2;
  const f1         = FLAVORS.find(f => f.name === selFlavor1);
  const f2         = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
  const p1         = flavorPrice(f1, selCustomerType);
  const p2         = f2 ? flavorPrice(f2, selCustomerType) : 0;
  const tubRevenue = isMixed ? p1 + p2 : selTubType * p1;
  const tubProfit  = isSeller ? 0 :
    isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost);
  const customer = document.getElementById('customer-name').value.trim();

  const payload = {
    date:         todayKey(),
    time:         new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    createdAt:    Date.now(),
    customer:     customer || '',
    flavor1:      selFlavor1,
    flavor2:      isMixed ? selFlavor2 : null,
    tubType:      selTubType,
    tubQty:       qty,
    pieces:       selTubType * qty,
    mixed:        isMixed,
    customerType: selCustomerType,   // 'normal' | 'reseller'
    revenue:      tubRevenue * qty,
    profit:       tubProfit * qty,
    paid:         false,
    payMethod:    null,
    delivered:    false,
    accountType:  accountType,
  };

  setSyncStatus('syncing', '⏫ Saving…');
  try {
    await addOrderToFirestore(currentUser.uid, payload);
    showToast('Order saved! 🍩');
  } catch {
    showToast('Saved offline — will sync when connected');
  }

  setSelFlavor1(null); setSelFlavor2(null); setSelTubType(null);
  setQty1(1); setQty2(1);
  setSelCustomerType('normal');
  document.getElementById('customer-name').value = '';
  updateTubUI(); updateFlavorUI(); updateCustomerTypeUI(); updatePreview();
  btn.disabled = false;
}

// ── Save Day ───────────────────────────────────────────────────────────────────

window.saveDay = async function() {
  if (!currentUser) return;
  const key = todayKey();
  const tod = todayOrders();
  if (!tod.length) { showToast('No orders today to save!'); return; }

  const { savedDays } = await import('./state.js');
  const existing = savedDays.find(d => d.dateKey === key);
  const isSeller = accountType === ACCOUNT_TYPE_SELLER;

  const pieceCounts  = {};
  const flavorCounts = {};
  tod.forEach(o => {
    const k = String(o.tubType || o.pieces);
    pieceCounts[k] = (pieceCounts[k] || 0) + (o.tubQty || 1);
    flavorCounts[o.flavor1] = (flavorCounts[o.flavor1] || 0) + o.pieces;
    if (o.flavor2) flavorCounts[o.flavor2] = (flavorCounts[o.flavor2] || 0) + (o.tubQty || 1);
  });
  const bestFlavor = Object.keys(flavorCounts).length
    ? Object.keys(flavorCounts).reduce((a, b) => flavorCounts[a] > flavorCounts[b] ? a : b)
    : '—';

  const snapshot = {
    dateKey:    key,
    month:      monthKey(new Date().getFullYear(), new Date().getMonth()),
    revenue:    tod.reduce((s, o) => s + o.revenue, 0),
    profit:     isSeller ? 0 : tod.reduce((s, o) => s + o.profit, 0),
    pieces:     tod.reduce((s, o) => s + o.pieces, 0),
    orderCount: tod.length,
    cashAmt:    tod.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.revenue, 0),
    gcashAmt:   tod.filter(o => o.payMethod === 'gcash').reduce((s, o) => s + o.revenue, 0),
    unpaidAmt:  tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0),
    // Reseller vs normal customer split
    normalRevenue:   tod.filter(o => o.customerType !== 'reseller').reduce((s, o) => s + o.revenue, 0),
    resellerRevenue: tod.filter(o => o.customerType === 'reseller').reduce((s, o) => s + o.revenue, 0),
    pieceCounts, bestFlavor, savedAt: Date.now(),
    accountType,
  };

  try {
    await saveDayToFirestore(currentUser.uid, existing ? existing.firestoreId : key, snapshot);
    showToast(existing ? 'Day updated in history ✓' : 'Day saved to history! 💾');
  } catch { showToast('Error saving day'); }
};

// ── Tab switching ──────────────────────────────────────────────────────────────

window.switchTab = function(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', ['add', 'orders', 'daily', 'analytics'][i] === tab));
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${tab}`));
  if (tab === 'analytics') renderAnalytics();
};

// ── Copy list ──────────────────────────────────────────────────────────────────

window.copyList = function() {
  const text = document.getElementById('daily-output').textContent;
  const btn  = document.getElementById('copy-btn');
  const reset = () => { btn.textContent = '📋 Copy List'; btn.classList.remove('copy-success'); };
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Copied!'; btn.classList.add('copy-success');
    setTimeout(reset, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Copied!');
  });
};

// ── Event listeners ────────────────────────────────────────────────────────────

document.getElementById('customer-name').addEventListener('input', updatePreview);
document.getElementById('tub-btn-1').addEventListener('click', () => selectTubType(1));
document.getElementById('tub-btn-2').addEventListener('click', () => selectTubType(2));
document.getElementById('minus-1').addEventListener('click', () => changeQty(1, -1));
document.getElementById('plus-1').addEventListener('click',  () => changeQty(1,  1));
document.getElementById('minus-2').addEventListener('click', () => changeQty(2, -1));
document.getElementById('plus-2').addEventListener('click',  () => changeQty(2,  1));
document.getElementById('add-btn').addEventListener('click', addOrder);

// ── Bootstrap ──────────────────────────────────────────────────────────────────

watchAuth(showApp, showAuthScreen);
