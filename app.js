import {
  selFlavor1, selFlavor2, selTubType, qty1, qty2,
  setSelFlavor1, setSelFlavor2, setSelTubType, setQty1, setQty2,
  setAnalyticsYear, setAnalyticsMonth,
  currentUser, setCurrentUser,
  accountType, setAccountType,
  selCustomerType, setSelCustomerType,
  setOrderFilters,
} from './state.js';
import {
  FLAVORS, ACCOUNT_TYPE_RESELLER, ACCOUNT_TYPE_MAIN_SELLER, flavorPrice,
  todayKey, monthKey, setDateHeader, showToast, setSyncStatus,
  ORDER_STATUSES,
} from './utils.js';
import {
  startOrdersListener, startDaysListener, stopListeners,
  addOrderToFirestore, saveDayToFirestore,
} from './firebase.js';
import { renderAnalytics } from './analytics.js';
import { renderAll, todayOrders } from './render.js';
import { watchAuth, loginByName, logout, register } from './auth.js';

const FORM_STORAGE_KEY = 'cinnabun_form_state_v2';

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
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = user.displayName || user.email;

  const badge = document.getElementById('account-type-badge');
  if (badge) {
    const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
    badge.textContent = isMain ? '🏪 Main Seller' : '🔄 Reseller';
    badge.className = `account-badge ${accountType}`;
  }

  applyAccountTypeUI();
  initApp();
}

function applyAccountTypeUI() {
  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
  document.querySelectorAll('.stat.profit').forEach(el => (el.style.display = isMain ? 'none' : ''));
}

function setAuthLoading(on) {
  const lb = document.getElementById('auth-login-btn');
  const rb = document.getElementById('auth-register-btn');
  if (lb) { lb.disabled = on; lb.textContent = on ? 'Signing in…' : 'Sign In'; }
  if (rb) { rb.disabled = on; rb.textContent = on ? 'Creating account…' : 'Create Account'; }
}
function showAuthError(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function friendlyAuthError(code, context) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return context === 'login' ? '❌ Username or password is incorrect.' : '❌ Something went wrong.';
    case 'auth/email-already-in-use': return '❌ Username already taken.';
    case 'auth/weak-password': return '❌ Password must be at least 6 characters.';
    case 'auth/too-many-requests': return '⏳ Too many attempts. Please wait and retry.';
    case 'auth/network-request-failed': return '📶 Check your internet connection.';
    default: return `❌ Something went wrong (${code || 'unknown'}).`;
  }
}

window.doLogin = async function () {
  const name = document.getElementById('auth-login-name').value.trim();
  const pw = document.getElementById('auth-pw').value;
  const err = document.getElementById('auth-error');
  err.textContent = '';
  if (!name) return showAuthError(err, 'Please enter your username.');
  if (!pw) return showAuthError(err, 'Please enter your password.');
  setAuthLoading(true);
  try { await loginByName(name, pw); }
  catch (e) { showAuthError(err, friendlyAuthError(e.code, 'login')); setAuthLoading(false); }
};

window.doRegister = async function () {
  const name = document.getElementById('auth-name').value.trim();
  const pw = document.getElementById('auth-pw2-new').value;
  const pw2 = document.getElementById('auth-pw2').value;
  const type = document.getElementById('auth-account-type').value;
  const err = document.getElementById('auth-error-reg');
  err.textContent = '';
  if (!name) return showAuthError(err, 'Please enter a username.');
  if (name.length < 2) return showAuthError(err, 'Username must be at least 2 characters.');
  if (!pw) return showAuthError(err, 'Please enter a password.');
  if (pw.length < 6) return showAuthError(err, 'Password must be at least 6 characters.');
  if (pw !== pw2) return showAuthError(err, 'Passwords do not match.');
  setAuthLoading(true);
  try { await register(name, pw, type); }
  catch (e) { showAuthError(err, friendlyAuthError(e.code, 'register')); setAuthLoading(false); }
};
window.doLogout = async function () { await logout(); setCurrentUser(null); setAccountType(null); };
window.showRegisterForm = function () { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
window.showLoginForm = function () { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

function initApp() {
  const now = new Date();
  setAnalyticsYear(now.getFullYear());
  setAnalyticsMonth(now.getMonth());

  setDateHeader();
  buildFlavorGrids();
  restoreFormState();
  updateCustomerTypeUI();
  bindOrderFilters();
  startOrdersListener(currentUser.uid);
  startDaysListener(currentUser.uid);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  renderAll();
}

window.setCustomerType = function (type) {
  setSelCustomerType(type);
  persistFormState();
  updateCustomerTypeUI();
  updatePreview();
};

function updateCustomerTypeUI() {
  const btnNormal = document.getElementById('ctype-normal');
  const btnReseller = document.getElementById('ctype-reseller');
  if (!btnNormal || !btnReseller) return;
  btnNormal.classList.toggle('ctype-active', selCustomerType === 'normal');
  btnReseller.classList.toggle('ctype-active', selCustomerType === 'reseller');

  document.querySelectorAll('.flavor-btn[data-flavor]').forEach(btn => {
    const f = FLAVORS.find(x => x.name === btn.dataset.flavor);
    const tag = btn.querySelector('.price-tag');
    if (f && tag) tag.textContent = `₱${flavorPrice(f, selCustomerType)}`;
  });
}

function buildFlavorGrids() {
  ['flavor1-grid', 'flavor2-grid'].forEach((id, idx) => {
    const grid = document.getElementById(id);
    grid.innerHTML = '';
    FLAVORS.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'flavor-btn';
      btn.innerHTML = `${f.name}<span class="price-tag">₱${flavorPrice(f, selCustomerType)}</span>`;
      btn.onclick = () => selectFlavor(f.name, idx === 1);
      btn.dataset.flavor = f.name;
      btn.dataset.which = idx === 1 ? '2' : '1';
      grid.appendChild(btn);
    });
  });
}

function selectFlavor(name, isF2) {
  if (isF2) setSelFlavor2(selFlavor2 === name ? null : name);
  else { setSelFlavor1(selFlavor1 === name ? null : name); setSelFlavor2(null); }
  persistFormState();
  updateFlavorUI();
  updatePreview();
}

function updateFlavorUI() {
  document.querySelectorAll('[data-which="1"]').forEach(b => b.className = `flavor-btn${b.dataset.flavor === selFlavor1 ? ' selected' : ''}`);
  document.querySelectorAll('[data-which="2"]').forEach(b => b.className = `flavor-btn${b.dataset.flavor === selFlavor2 ? ' selected-2' : ''}`);
  const show2 = selTubType === 2 && selFlavor1;
  document.getElementById('mixed-hint').className = `mixed-hint${show2 ? ' show' : ''}`;
  document.getElementById('flavor2-field').style.display = show2 ? 'block' : 'none';
  updateCustomerTypeUI();
}

function selectTubType(type) {
  setSelTubType(selTubType === type ? null : type);
  if (selTubType !== 2) setSelFlavor2(null);
  persistFormState();
  updateTubUI();
  updateFlavorUI();
  updatePreview();
}

function changeQty(type, delta) {
  if (type === 1) setQty1(qty1 + delta);
  else setQty2(qty2 + delta);
  persistFormState();
  updateTubUI();
  updatePreview();
}

function updateTubUI() {
  document.getElementById('tub-opt-1')?.classList.toggle('active-tub', selTubType === 1);
  document.getElementById('tub-opt-2')?.classList.toggle('active-tub', selTubType === 2);
  document.getElementById('tub-btn-1')?.classList.toggle('sel', selTubType === 1);
  document.getElementById('tub-btn-2')?.classList.toggle('sel', selTubType === 2);
  document.getElementById('qty-1').textContent = qty1;
  document.getElementById('qty-2').textContent = qty2;
  document.getElementById('minus-1').disabled = qty1 <= 1;
  document.getElementById('minus-2').disabled = qty2 <= 1;
}

function updatePreview() {
  const preview = document.getElementById('order-preview');
  const addBtn = document.getElementById('add-btn');
  const customer = document.getElementById('customer-name').value.trim();
  if (!selFlavor1 || !selTubType) { preview.innerHTML = '<span>Select flavor &amp; tub size above…</span>'; addBtn.disabled = true; return; }

  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
  const isMixed = selTubType === 2 && selFlavor2;
  const qty = selTubType === 1 ? qty1 : qty2;
  const f1 = FLAVORS.find(f => f.name === selFlavor1);
  const f2 = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
  const p1 = flavorPrice(f1, selCustomerType);
  const p2 = f2 ? flavorPrice(f2, selCustomerType) : 0;
  const tubRevenue = isMixed ? p1 + p2 : selTubType * p1;
  const tubProfit = isMain ? 0 : (isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost));
  const totalRevenue = tubRevenue * qty;
  const totalProfit = tubProfit * qty;
  const flavorLabel = isMixed ? `${selFlavor1} + ${selFlavor2}` : selFlavor1;

  preview.innerHTML = `<span class="preview-text"><strong>${flavorLabel}</strong><br><span style="font-size:10px;color:var(--muted)">${qty} × ${selTubType}pc tub</span></span>
  <span class="preview-price">₱${totalRevenue}${!isMain ? `<div style="font-size:9px;color:var(--green)">+₱${totalProfit}</div>` : ''}</span>`;
  addBtn.disabled = false;
  if (customer.length > 80) addBtn.disabled = true;
}

async function addOrder() {
  if (!selFlavor1 || !selTubType || !currentUser) return;
  const customer = document.getElementById('customer-name').value.trim();
  if (customer.length > 80) return showToast('Customer name is too long.');

  const btn = document.getElementById('add-btn');
  btn.disabled = true;
  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
  const isMixed = selTubType === 2 && selFlavor2;
  const qty = selTubType === 1 ? qty1 : qty2;
  const f1 = FLAVORS.find(f => f.name === selFlavor1);
  const f2 = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
  const p1 = flavorPrice(f1, selCustomerType);
  const p2 = f2 ? flavorPrice(f2, selCustomerType) : 0;
  const tubRev = isMixed ? p1 + p2 : selTubType * p1;
  const tubProf = isMain ? 0 : (isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost));

  const payload = {
    date: todayKey(),
    time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
    customer: customer || '',
    flavor1: selFlavor1,
    flavor2: isMixed ? selFlavor2 : null,
    tubType: selTubType,
    tubQty: qty,
    pieces: selTubType * qty,
    mixed: isMixed,
    customerType: selCustomerType,
    revenue: tubRev * qty,
    profit: tubProf * qty,
    paid: false,
    payMethod: null,
    status: ORDER_STATUSES[0],
    accountType,
  };

  setSyncStatus('syncing', '⏫ Saving…');
  try { await addOrderToFirestore(currentUser.uid, payload); showToast('Order saved! 🍩'); }
  catch { showToast('Unable to save right now. Please try again.'); }

  setSelFlavor1(null); setSelFlavor2(null); setSelTubType(null); setQty1(1); setQty2(1);
  document.getElementById('customer-name').value = '';
  persistFormState();
  updateTubUI(); updateFlavorUI(); updatePreview();
  btn.disabled = false;
}

window.saveDay = async function () {
  if (!currentUser) return;
  const key = todayKey();
  const tod = todayOrders();
  if (!tod.length) return showToast('No orders today to save!');

  const { savedDays } = await import('./state.js');
  const existing = savedDays.find(d => d.dateKey === key);
  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
  const pieceCounts = {};
  const flavorCounts = {};

  tod.forEach(o => {
    const k = String(o.tubType || o.pieces);
    pieceCounts[k] = (pieceCounts[k] || 0) + (o.tubQty || 1);
    flavorCounts[o.flavor1] = (flavorCounts[o.flavor1] || 0) + o.pieces;
    if (o.flavor2) flavorCounts[o.flavor2] = (flavorCounts[o.flavor2] || 0) + (o.tubQty || 1);
  });

  const bestFlavor = Object.keys(flavorCounts).length ? Object.keys(flavorCounts).reduce((a, b) => flavorCounts[a] > flavorCounts[b] ? a : b) : '—';
  const snapshot = {
    dateKey: key,
    month: monthKey(new Date().getFullYear(), new Date().getMonth()),
    revenue: tod.reduce((s, o) => s + o.revenue, 0),
    profit: isMain ? 0 : tod.reduce((s, o) => s + o.profit, 0),
    pieces: tod.reduce((s, o) => s + o.pieces, 0),
    orderCount: tod.length,
    cashAmt: tod.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.revenue, 0),
    gcashAmt: tod.filter(o => o.payMethod === 'gcash').reduce((s, o) => s + o.revenue, 0),
    unpaidAmt: tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0),
    normalRevenue: tod.filter(o => o.customerType !== 'reseller').reduce((s, o) => s + o.revenue, 0),
    resellerRevenue: tod.filter(o => o.customerType === 'reseller').reduce((s, o) => s + o.revenue, 0),
    pieceCounts, bestFlavor, savedAt: Date.now(), accountType,
  };

  try { await saveDayToFirestore(currentUser.uid, existing ? existing.firestoreId : key, snapshot); showToast(existing ? 'Day updated in history ✓' : 'Day saved to history! 💾'); }
  catch { showToast('Error saving day'); }
};

window.switchTab = function (tab) {
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', ['add', 'orders', 'daily', 'analytics'][i] === tab));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${tab}`));
  if (tab === 'analytics') renderAnalytics();
};

window.copyList = function () {
  const text = document.getElementById('daily-output').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
};

function bindOrderFilters() {
  const q = document.getElementById('order-search');
  const status = document.getElementById('order-status-filter');
  const pay = document.getElementById('order-payment-filter');
  const sort = document.getElementById('order-sort');
  if (!q) return;

  q.addEventListener('input', e => { setOrderFilters({ query: e.target.value.trim().toLowerCase() }); renderAll(); });
  status.addEventListener('change', e => { setOrderFilters({ status: e.target.value }); renderAll(); });
  pay.addEventListener('change', e => { setOrderFilters({ payment: e.target.value }); renderAll(); });
  sort.addEventListener('change', e => { setOrderFilters({ sortBy: e.target.value }); renderAll(); });
}

function persistFormState() {
  const data = { selFlavor1, selFlavor2, selTubType, qty1, qty2, selCustomerType };
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
}
function restoreFormState() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return;
    const v = JSON.parse(raw);
    setSelFlavor1(v.selFlavor1 || null);
    setSelFlavor2(v.selFlavor2 || null);
    setSelTubType([1, 2].includes(v.selTubType) ? v.selTubType : null);
    setQty1(v.qty1 || 1); setQty2(v.qty2 || 1);
    setSelCustomerType(v.selCustomerType || 'normal');
  } catch {}
  updateTubUI(); updateFlavorUI(); updatePreview();
}

// listeners
['auth-login-btn','auth-register-btn','auth-login-name','auth-pw','auth-name','auth-pw2-new','auth-pw2'].forEach(() => {});
document.getElementById('auth-login-btn').addEventListener('click', window.doLogin);
document.getElementById('auth-register-btn').addEventListener('click', window.doRegister);
document.getElementById('auth-login-name').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
document.getElementById('auth-pw').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
document.getElementById('auth-name').addEventListener('keydown', e => { if (e.key === 'Enter') window.doRegister(); });
document.getElementById('auth-pw2-new').addEventListener('keydown', e => { if (e.key === 'Enter') window.doRegister(); });
document.getElementById('auth-pw2').addEventListener('keydown', e => { if (e.key === 'Enter') window.doRegister(); });
document.querySelector('.auth-link[data-action="register"]')?.addEventListener('click', window.showRegisterForm);
document.querySelector('.auth-link[data-action="login"]')?.addEventListener('click', window.showLoginForm);

document.getElementById('customer-name').addEventListener('input', () => { persistFormState(); updatePreview(); });
document.getElementById('tub-btn-1').addEventListener('click', () => selectTubType(1));
document.getElementById('tub-btn-2').addEventListener('click', () => selectTubType(2));
document.getElementById('minus-1').addEventListener('click', () => changeQty(1, -1));
document.getElementById('plus-1').addEventListener('click', () => changeQty(1, 1));
document.getElementById('minus-2').addEventListener('click', () => changeQty(2, -1));
document.getElementById('plus-2').addEventListener('click', () => changeQty(2, 1));
document.getElementById('add-btn').addEventListener('click', addOrder);

document.getElementById('ctype-normal')?.addEventListener('click', () => window.setCustomerType('normal'));
document.getElementById('ctype-reseller')?.addEventListener('click', () => window.setCustomerType('reseller'));
document.getElementById('save-day-btn')?.addEventListener('click', window.saveDay);
document.getElementById('copy-btn')?.addEventListener('click', window.copyList);
document.getElementById('logout-btn')?.addEventListener('click', window.doLogout);
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => window.switchTab(tab.dataset.tab)));

watchAuth(showApp, showAuthScreen);
