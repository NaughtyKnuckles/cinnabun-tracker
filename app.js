diff --git a/app.js b/app.js
index 02773ee7b5e55966c8aa0ab3a8da06824f8acc4f..1d586baba57e6306064bb153ebd0d119e3c409b9 100644
--- a/app.js
+++ b/app.js
@@ -1,479 +1,409 @@
-// ── app.js ─────────────────────────────────────────────────────────────────────
 import {
   selFlavor1, selFlavor2, selTubType, qty1, qty2,
   setSelFlavor1, setSelFlavor2, setSelTubType, setQty1, setQty2,
   setAnalyticsYear, setAnalyticsMonth,
   currentUser, setCurrentUser,
   accountType, setAccountType,
   selCustomerType, setSelCustomerType,
+  setOrderFilters,
 } from './state.js';
 import {
   FLAVORS, ACCOUNT_TYPE_RESELLER, ACCOUNT_TYPE_MAIN_SELLER, flavorPrice,
   todayKey, monthKey, setDateHeader, showToast, setSyncStatus,
+  ORDER_STATUSES,
 } from './utils.js';
 import {
   startOrdersListener, startDaysListener, stopListeners,
   addOrderToFirestore, saveDayToFirestore,
 } from './firebase.js';
 import { renderAnalytics } from './analytics.js';
-import { todayOrders } from './render.js';
+import { renderAll, todayOrders } from './render.js';
 import { watchAuth, loginByName, logout, register } from './auth.js';
 
-// ── Auth flow ──────────────────────────────────────────────────────────────────
+const FORM_STORAGE_KEY = 'cinnabun_form_state_v2';
 
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
-
   document.getElementById('user-display-name').textContent = user.displayName || user.email;
 
-  // Account badge
   const badge = document.getElementById('account-type-badge');
   if (badge) {
     const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
     badge.textContent = isMain ? '🏪 Main Seller' : '🔄 Reseller';
-    badge.className   = `account-badge ${accountType}`;
+    badge.className = `account-badge ${accountType}`;
   }
 
   applyAccountTypeUI();
   initApp();
 }
 
 function applyAccountTypeUI() {
   const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
-  // Hide profit stat on Add tab for main seller
-  document.querySelectorAll('.stat.profit').forEach(el => el.style.display = isMain ? 'none' : '');
-}
-
-window.doLogin = async function() {
-  const name = document.getElementById('auth-login-name').value.trim();
-  const pw   = document.getElementById('auth-pw').value;
-  const err  = document.getElementById('auth-error');
-  err.textContent = '';
-  if (!name) { showAuthError(err, 'Please enter your username.'); return; }
-  if (!pw)   { showAuthError(err, 'Please enter your password.'); return; }
-  setAuthLoading(true);
-  try {
-    await loginByName(name, pw);
-  } catch (e) {
-    showAuthError(err, friendlyAuthError(e.code, 'login'));
-    setAuthLoading(false);
-  }
-};
-
-window.doRegister = async function() {
-  const name = document.getElementById('auth-name').value.trim();
-  const pw   = document.getElementById('auth-pw2-new').value;
-  const pw2  = document.getElementById('auth-pw2').value;
-  const type = document.getElementById('auth-account-type').value;
-  const err  = document.getElementById('auth-error-reg');
-  err.textContent = '';
-  if (!name)            { showAuthError(err, 'Please enter a username.'); return; }
-  if (name.length < 2)  { showAuthError(err, 'Username must be at least 2 characters.'); return; }
-  if (!pw)              { showAuthError(err, 'Please enter a password.'); return; }
-  if (pw.length < 6)    { showAuthError(err, 'Password must be at least 6 characters.'); return; }
-  if (pw !== pw2)       { showAuthError(err, 'Passwords do not match. Please try again.'); return; }
-  setAuthLoading(true);
-  try {
-    await register(name, pw, type);
-  } catch (e) {
-    showAuthError(err, friendlyAuthError(e.code, 'register'));
-    setAuthLoading(false);
-  }
-};
-
-window.doLogout = async function() {
-  await logout();
-  setCurrentUser(null);
-  setAccountType(null);
-};
-
-window.showRegisterForm = function() {
-  document.getElementById('login-form').classList.add('hidden');
-  document.getElementById('register-form').classList.remove('hidden');
-  document.getElementById('auth-error').textContent = '';
-  document.getElementById('auth-error-reg').textContent = '';
-};
+  document.querySelectorAll('.stat.profit').forEach(el => (el.style.display = isMain ? 'none' : ''));
 
-window.showLoginForm = function() {
-  document.getElementById('register-form').classList.add('hidden');
-  document.getElementById('login-form').classList.remove('hidden');
-  document.getElementById('auth-error').textContent = '';
-  document.getElementById('auth-error-reg').textContent = '';
-};
+  const sellingToBar = document.querySelector('.selling-to-bar');
+  if (sellingToBar) sellingToBar.style.display = isMain ? 'flex' : 'none';
 
-window.authKeydown = function(e) {
-  if (e.key !== 'Enter') return;
-  const regForm = document.getElementById('register-form');
-  if (regForm.classList.contains('hidden')) window.doLogin();
-  else window.doRegister();
-};
+  // Reseller accounts should always use normal pricing/customer type.
+  if (!isMain) setSelCustomerType('normal');
+}
 
 function setAuthLoading(on) {
-  const lb = document.getElementById('auth-login-btn');
-  const rb = document.getElementById('auth-register-btn');
-  if (lb) { lb.disabled = on; lb.textContent = on ? 'Signing in…'       : 'Sign In'; }
+  const lb = byId('auth-login-btn');
+  const rb = byId('auth-register-btn');
+  if (lb) { lb.disabled = on; lb.textContent = on ? 'Signing in…' : 'Sign In'; }
   if (rb) { rb.disabled = on; rb.textContent = on ? 'Creating account…' : 'Create Account'; }
 }
-
-function showAuthError(el, msg) {
-  el.textContent = msg;
-  el.style.display = 'block';
-}
-
+function showAuthError(el, msg) { el.textContent = msg; el.style.display = 'block'; }
 function friendlyAuthError(code, context) {
   switch (code) {
     case 'auth/user-not-found':
     case 'auth/wrong-password':
-    case 'auth/invalid-credential':
-      return context === 'login'
-        ? '❌ Username or password is incorrect.'
-        : '❌ Something went wrong. Please try again.';
-    case 'auth/email-already-in-use':
-      return '❌ That username is already taken. Please choose another.';
-    case 'auth/weak-password':
-      return '❌ Password must be at least 6 characters.';
-    case 'auth/too-many-requests':
-      return '⏳ Too many failed attempts. Please wait a moment and try again.';
-    case 'auth/network-request-failed':
-      return '📶 No internet connection. Please check your network.';
-    default:
-      return `❌ Something went wrong (${code}). Please try again.`;
+    case 'auth/invalid-credential': return context === 'login' ? '❌ Username or password is incorrect.' : '❌ Something went wrong.';
+    case 'auth/email-already-in-use': return '❌ Username already taken.';
+    case 'auth/weak-password': return '❌ Password must be at least 6 characters.';
+    case 'auth/too-many-requests': return '⏳ Too many attempts. Please wait and retry.';
+    case 'auth/network-request-failed': return '📶 Check your internet connection.';
+    default: return `❌ Something went wrong (${code || 'unknown'}).`;
   }
 }
 
-// ── App init ───────────────────────────────────────────────────────────────────
+window.doLogin = async function () {
+  const name = document.getElementById('auth-login-name').value.trim();
+  const pw = document.getElementById('auth-pw').value;
+  const err = document.getElementById('auth-error');
+  err.textContent = '';
+  if (!name) return showAuthError(err, 'Please enter your username.');
+  if (!pw) return showAuthError(err, 'Please enter your password.');
+  setAuthLoading(true);
+  try { await loginByName(name, pw); }
+  catch (e) { showAuthError(err, friendlyAuthError(e.code, 'login')); setAuthLoading(false); }
+};
+
+window.doRegister = async function () {
+  const name = document.getElementById('auth-name').value.trim();
+  const pw = document.getElementById('auth-pw2-new').value;
+  const pw2 = document.getElementById('auth-pw2').value;
+  const type = document.getElementById('auth-account-type').value;
+  const err = document.getElementById('auth-error-reg');
+  err.textContent = '';
+  if (!name) return showAuthError(err, 'Please enter a username.');
+  if (name.length < 2) return showAuthError(err, 'Username must be at least 2 characters.');
+  if (!pw) return showAuthError(err, 'Please enter a password.');
+  if (pw.length < 6) return showAuthError(err, 'Password must be at least 6 characters.');
+  if (pw !== pw2) return showAuthError(err, 'Passwords do not match.');
+  setAuthLoading(true);
+  try { await register(name, pw, type); }
+  catch (e) { showAuthError(err, friendlyAuthError(e.code, 'register')); setAuthLoading(false); }
+};
+window.doLogout = async function () { await logout(); setCurrentUser(null); setAccountType(null); };
+window.showRegisterForm = function () { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
+window.showLoginForm = function () { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };
 
 function initApp() {
   const now = new Date();
   setAnalyticsYear(now.getFullYear());
   setAnalyticsMonth(now.getMonth());
 
   setDateHeader();
   buildFlavorGrids();
+  restoreFormState();
   updateCustomerTypeUI();
+  bindOrderFilters();
   startOrdersListener(currentUser.uid);
   startDaysListener(currentUser.uid);
-
   if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
+  renderAll();
 }
 
-// ── Selling-to toggle (sticky) ─────────────────────────────────────────────────
-
-window.setCustomerType = function(type) {
+window.setCustomerType = function (type) {
+  if (accountType !== ACCOUNT_TYPE_MAIN_SELLER) return;
   setSelCustomerType(type);
+  persistFormState();
   updateCustomerTypeUI();
   updatePreview();
 };
 
 function updateCustomerTypeUI() {
-  const btnNormal   = document.getElementById('ctype-normal');
-  const btnReseller = document.getElementById('ctype-reseller');
-  if (!btnNormal) return;
-  btnNormal.classList.toggle('ctype-active',   selCustomerType === 'normal');
+  const btnNormal = byId('ctype-normal');
+  const btnReseller = byId('ctype-reseller');
+  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
+  if (!btnNormal || !btnReseller) return;
+
+  if (!isMain && selCustomerType !== 'normal') setSelCustomerType('normal');
+  btnNormal.classList.toggle('ctype-active', selCustomerType === 'normal');
   btnReseller.classList.toggle('ctype-active', selCustomerType === 'reseller');
 
-  // Update price labels on flavor buttons to reflect active customer type
   document.querySelectorAll('.flavor-btn[data-flavor]').forEach(btn => {
-    const f = FLAVORS.find(f => f.name === btn.dataset.flavor);
-    if (!f) return;
+    const f = FLAVORS.find(x => x.name === btn.dataset.flavor);
     const tag = btn.querySelector('.price-tag');
-    if (tag) tag.textContent = `₱${flavorPrice(f, selCustomerType)}`;
+    if (f && tag) tag.textContent = `₱${flavorPrice(f, selCustomerType)}`;
   });
 }
 
-// ── Flavor selection ───────────────────────────────────────────────────────────
-
 function buildFlavorGrids() {
-  ['flavor1-grid', 'flavor2-grid'].forEach(id => document.getElementById(id).innerHTML = '');
-  ['flavor1-grid', 'flavor2-grid'].forEach((id, isF2) => {
-    const grid = document.getElementById(id);
+  ['flavor1-grid', 'flavor2-grid'].forEach((id, idx) => {
+    const grid = byId(id);
+    if (!grid) return;
+    grid.innerHTML = '';
     FLAVORS.forEach(f => {
       const btn = document.createElement('button');
       btn.className = 'flavor-btn';
       btn.innerHTML = `${f.name}<span class="price-tag">₱${flavorPrice(f, selCustomerType)}</span>`;
-      btn.onclick = () => selectFlavor(f.name, !!isF2);
+      btn.onclick = () => selectFlavor(f.name, idx === 1);
       btn.dataset.flavor = f.name;
-      btn.dataset.which  = isF2 ? '2' : '1';
+      btn.dataset.which = idx === 1 ? '2' : '1';
       grid.appendChild(btn);
     });
   });
 }
 
 function selectFlavor(name, isF2) {
-  if (isF2) {
-    setSelFlavor2(selFlavor2 === name ? null : name);
-  } else {
-    setSelFlavor1(selFlavor1 === name ? null : name);
-    setSelFlavor2(null);
-  }
+  if (isF2) setSelFlavor2(selFlavor2 === name ? null : name);
+  else { setSelFlavor1(selFlavor1 === name ? null : name); setSelFlavor2(null); }
+  persistFormState();
   updateFlavorUI();
   updatePreview();
 }
 
 function updateFlavorUI() {
-  document.querySelectorAll('[data-which="1"]').forEach(b =>
-    b.className = 'flavor-btn' + (b.dataset.flavor === selFlavor1 ? ' selected' : ''));
-  document.querySelectorAll('[data-which="2"]').forEach(b =>
-    b.className = 'flavor-btn' + (b.dataset.flavor === selFlavor2 ? ' selected-2' : ''));
+  document.querySelectorAll('[data-which="1"]').forEach(b => b.className = `flavor-btn${b.dataset.flavor === selFlavor1 ? ' selected' : ''}`);
+  document.querySelectorAll('[data-which="2"]').forEach(b => b.className = `flavor-btn${b.dataset.flavor === selFlavor2 ? ' selected-2' : ''}`);
   const show2 = selTubType === 2 && selFlavor1;
-  document.getElementById('mixed-hint').className        = 'mixed-hint' + (show2 ? ' show' : '');
+  document.getElementById('mixed-hint').className = `mixed-hint${show2 ? ' show' : ''}`;
   document.getElementById('flavor2-field').style.display = show2 ? 'block' : 'none';
-  updateCustomerTypeUI(); // re-apply price tags after class reset
+  updateCustomerTypeUI();
 }
 
-// ── Tub type / qty ─────────────────────────────────────────────────────────────
-
 function selectTubType(type) {
   setSelTubType(selTubType === type ? null : type);
   if (selTubType !== 2) setSelFlavor2(null);
-  updateTubUI(); updateFlavorUI(); updatePreview();
+  persistFormState();
+  updateTubUI();
+  updateFlavorUI();
+  updatePreview();
 }
 
 function changeQty(type, delta) {
-  if (type === 1) setQty1(Math.max(1, qty1 + delta));
-  else            setQty2(Math.max(1, qty2 + delta));
-  updateTubUI(); updatePreview();
+  if (type === 1) setQty1(qty1 + delta);
+  else setQty2(qty2 + delta);
+  persistFormState();
+  updateTubUI();
+  updatePreview();
 }
 
 function updateTubUI() {
   document.getElementById('tub-opt-1')?.classList.toggle('active-tub', selTubType === 1);
   document.getElementById('tub-opt-2')?.classList.toggle('active-tub', selTubType === 2);
   document.getElementById('tub-btn-1')?.classList.toggle('sel', selTubType === 1);
   document.getElementById('tub-btn-2')?.classList.toggle('sel', selTubType === 2);
-  const q1el = document.getElementById('qty-1'); if (q1el) q1el.textContent = qty1;
-  const q2el = document.getElementById('qty-2'); if (q2el) q2el.textContent = qty2;
-  const m1   = document.getElementById('minus-1'); if (m1) m1.disabled = qty1 <= 1;
-  const m2   = document.getElementById('minus-2'); if (m2) m2.disabled = qty2 <= 1;
+  document.getElementById('qty-1').textContent = qty1;
+  document.getElementById('qty-2').textContent = qty2;
+  document.getElementById('minus-1').disabled = qty1 <= 1;
+  document.getElementById('minus-2').disabled = qty2 <= 1;
 }
 
-// ── Order preview ──────────────────────────────────────────────────────────────
-
 function updatePreview() {
-  const preview  = document.getElementById('order-preview');
-  const addBtn   = document.getElementById('add-btn');
+  const preview = document.getElementById('order-preview');
+  const addBtn = document.getElementById('add-btn');
   const customer = document.getElementById('customer-name').value.trim();
-  const isMain   = accountType === ACCOUNT_TYPE_MAIN_SELLER;
+  if (!selFlavor1 || !selTubType) { preview.innerHTML = '<span>Select flavor &amp; tub size above…</span>'; addBtn.disabled = true; return; }
 
-  if (!selFlavor1 || !selTubType) {
-    preview.innerHTML = '<span>Select flavor &amp; tub size above…</span>';
-    addBtn.disabled = true;
-    return;
-  }
-
-  const isMixed    = selTubType === 2 && selFlavor2;
-  const qty        = selTubType === 1 ? qty1 : qty2;
-  const f1         = FLAVORS.find(f => f.name === selFlavor1);
-  const f2         = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
-  const p1         = flavorPrice(f1, selCustomerType);
-  const p2         = f2 ? flavorPrice(f2, selCustomerType) : 0;
+  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
+  const isMixed = selTubType === 2 && selFlavor2;
+  const qty = selTubType === 1 ? qty1 : qty2;
+  const f1 = FLAVORS.find(f => f.name === selFlavor1);
+  const f2 = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
+  const p1 = flavorPrice(f1, selCustomerType);
+  const p2 = f2 ? flavorPrice(f2, selCustomerType) : 0;
   const tubRevenue = isMixed ? p1 + p2 : selTubType * p1;
-  const tubProfit  = isMain ? null
-    : isMixed ? (p1 - f1.cost) + (p2 - f2.cost)
-    : selTubType * (p1 - f1.cost);
+  const tubProfit = isMain ? 0 : (isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost));
   const totalRevenue = tubRevenue * qty;
-  const totalProfit  = tubProfit !== null ? tubProfit * qty : null;
-  const totalPieces  = selTubType * qty;
-  const flavorLabel  = isMixed ? `${selFlavor1} + ${selFlavor2}` : selFlavor1;
-  const tubLabel     = `${qty} × ${selTubType}pc tub${qty > 1 ? 's' : ''}`;
-  const ctypeBadge   = selCustomerType === 'reseller'
-    ? `<span class="ctype-tag reseller-tag">🔄 Reseller price</span>`
-    : `<span class="ctype-tag normal-tag">👤 Normal price</span>`;
-  const cHTML = customer
-    ? `<span style="color:var(--amber);font-size:10px;display:block;margin-top:2px">👤 ${customer}</span>` : '';
-
-  preview.innerHTML = `
-    <span class="preview-text">
-      <strong>${flavorLabel}</strong><br>
-      <span style="font-size:10px;color:var(--muted)">${tubLabel} = ${totalPieces} pc total</span>
-      ${ctypeBadge}${cHTML}
-    </span>
-    <span class="preview-price">
-      ₱${totalRevenue}
-      ${totalProfit !== null ? `<div style="font-size:9px;color:var(--green);font-weight:400">+₱${totalProfit} profit</div>` : ''}
-      ${qty > 1 ? `<div class="preview-breakdown">₱${tubRevenue}/tub</div>` : ''}
-    </span>`;
+  const totalProfit = tubProfit * qty;
+  const flavorLabel = isMixed ? `${selFlavor1} + ${selFlavor2}` : selFlavor1;
+
+  preview.innerHTML = `<span class="preview-text"><strong>${flavorLabel}</strong><br><span style="font-size:10px;color:var(--muted)">${qty} × ${selTubType}pc tub</span></span>
+  <span class="preview-price">₱${totalRevenue}${!isMain ? `<div style="font-size:9px;color:var(--green)">+₱${totalProfit}</div>` : ''}</span>`;
   addBtn.disabled = false;
+  if (customer.length > 80) addBtn.disabled = true;
 }
 
-// ── Add order ──────────────────────────────────────────────────────────────────
-
 async function addOrder() {
   if (!selFlavor1 || !selTubType || !currentUser) return;
+  const customer = document.getElementById('customer-name').value.trim();
+  if (customer.length > 80) return showToast('Customer name is too long.');
+
   const btn = document.getElementById('add-btn');
   btn.disabled = true;
-
-  const isMain   = accountType === ACCOUNT_TYPE_MAIN_SELLER;
-  const isMixed  = selTubType === 2 && selFlavor2;
-  const qty      = selTubType === 1 ? qty1 : qty2;
-  const f1       = FLAVORS.find(f => f.name === selFlavor1);
-  const f2       = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
-  const p1       = flavorPrice(f1, selCustomerType);
-  const p2       = f2 ? flavorPrice(f2, selCustomerType) : 0;
-  const tubRev   = isMixed ? p1 + p2 : selTubType * p1;
-  const tubProf  = isMain ? 0
-    : isMixed ? (p1 - f1.cost) + (p2 - f2.cost)
-    : selTubType * (p1 - f1.cost);
-  const customer = document.getElementById('customer-name').value.trim();
+  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
+  const isMixed = selTubType === 2 && selFlavor2;
+  const qty = selTubType === 1 ? qty1 : qty2;
+  const f1 = FLAVORS.find(f => f.name === selFlavor1);
+  const f2 = isMixed ? FLAVORS.find(f => f.name === selFlavor2) : null;
+  const p1 = flavorPrice(f1, selCustomerType);
+  const p2 = f2 ? flavorPrice(f2, selCustomerType) : 0;
+  const tubRev = isMixed ? p1 + p2 : selTubType * p1;
+  const tubProf = isMain ? 0 : (isMixed ? (p1 - f1.cost) + (p2 - f2.cost) : selTubType * (p1 - f1.cost));
 
   const payload = {
-    date:         todayKey(),
-    time:         new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
-    createdAt:    Date.now(),
-    customer:     customer || '',
-    flavor1:      selFlavor1,
-    flavor2:      isMixed ? selFlavor2 : null,
-    tubType:      selTubType,
-    tubQty:       qty,
-    pieces:       selTubType * qty,
-    mixed:        isMixed,
+    date: todayKey(),
+    time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
+    createdAt: Date.now(),
+    customer: customer || '',
+    flavor1: selFlavor1,
+    flavor2: isMixed ? selFlavor2 : null,
+    tubType: selTubType,
+    tubQty: qty,
+    pieces: selTubType * qty,
+    mixed: isMixed,
     customerType: selCustomerType,
-    revenue:      tubRev * qty,
-    profit:       tubProf * qty,
-    paid:         false,
-    payMethod:    null,
-    delivered:    false,
+    revenue: tubRev * qty,
+    profit: tubProf * qty,
+    paid: false,
+    payMethod: null,
+    status: ORDER_STATUSES[0],
     accountType,
   };
 
   setSyncStatus('syncing', '⏫ Saving…');
-  try {
-    await addOrderToFirestore(currentUser.uid, payload);
-    showToast('Order saved! 🍩');
-  } catch {
-    showToast('Saved offline — will sync when connected');
-  }
+  try { await addOrderToFirestore(currentUser.uid, payload); showToast('Order saved! 🍩'); }
+  catch { showToast('Unable to save right now. Please try again.'); }
 
-  // Reset flavor + tub but KEEP selCustomerType (sticky)
-  setSelFlavor1(null); setSelFlavor2(null); setSelTubType(null);
-  setQty1(1); setQty2(1);
+  setSelFlavor1(null); setSelFlavor2(null); setSelTubType(null); setQty1(1); setQty2(1);
   document.getElementById('customer-name').value = '';
+  persistFormState();
   updateTubUI(); updateFlavorUI(); updatePreview();
   btn.disabled = false;
 }
 
-// ── Save Day ───────────────────────────────────────────────────────────────────
-
-window.saveDay = async function() {
+window.saveDay = async function () {
   if (!currentUser) return;
   const key = todayKey();
   const tod = todayOrders();
-  if (!tod.length) { showToast('No orders today to save!'); return; }
+  if (!tod.length) return showToast('No orders today to save!');
 
   const { savedDays } = await import('./state.js');
   const existing = savedDays.find(d => d.dateKey === key);
-  const isMain   = accountType === ACCOUNT_TYPE_MAIN_SELLER;
-
-  const pieceCounts  = {};
+  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
+  const pieceCounts = {};
   const flavorCounts = {};
+
   tod.forEach(o => {
     const k = String(o.tubType || o.pieces);
     pieceCounts[k] = (pieceCounts[k] || 0) + (o.tubQty || 1);
     flavorCounts[o.flavor1] = (flavorCounts[o.flavor1] || 0) + o.pieces;
     if (o.flavor2) flavorCounts[o.flavor2] = (flavorCounts[o.flavor2] || 0) + (o.tubQty || 1);
   });
-  const bestFlavor = Object.keys(flavorCounts).length
-    ? Object.keys(flavorCounts).reduce((a, b) => flavorCounts[a] > flavorCounts[b] ? a : b) : '—';
 
+  const bestFlavor = Object.keys(flavorCounts).length ? Object.keys(flavorCounts).reduce((a, b) => flavorCounts[a] > flavorCounts[b] ? a : b) : '—';
   const snapshot = {
-    dateKey:         key,
-    month:           monthKey(new Date().getFullYear(), new Date().getMonth()),
-    revenue:         tod.reduce((s, o) => s + o.revenue, 0),
-    profit:          isMain ? 0 : tod.reduce((s, o) => s + o.profit, 0),
-    pieces:          tod.reduce((s, o) => s + o.pieces, 0),
-    orderCount:      tod.length,
-    cashAmt:         tod.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.revenue, 0),
-    gcashAmt:        tod.filter(o => o.payMethod === 'gcash').reduce((s, o) => s + o.revenue, 0),
-    unpaidAmt:       tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0),
-    normalRevenue:   tod.filter(o => o.customerType !== 'reseller').reduce((s, o) => s + o.revenue, 0),
+    dateKey: key,
+    month: monthKey(new Date().getFullYear(), new Date().getMonth()),
+    revenue: tod.reduce((s, o) => s + o.revenue, 0),
+    profit: isMain ? 0 : tod.reduce((s, o) => s + o.profit, 0),
+    pieces: tod.reduce((s, o) => s + o.pieces, 0),
+    orderCount: tod.length,
+    cashAmt: tod.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.revenue, 0),
+    gcashAmt: tod.filter(o => o.payMethod === 'gcash').reduce((s, o) => s + o.revenue, 0),
+    unpaidAmt: tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0),
+    normalRevenue: tod.filter(o => o.customerType !== 'reseller').reduce((s, o) => s + o.revenue, 0),
     resellerRevenue: tod.filter(o => o.customerType === 'reseller').reduce((s, o) => s + o.revenue, 0),
     pieceCounts, bestFlavor, savedAt: Date.now(), accountType,
   };
 
-  try {
-    await saveDayToFirestore(currentUser.uid, existing ? existing.firestoreId : key, snapshot);
-    showToast(existing ? 'Day updated in history ✓' : 'Day saved to history! 💾');
-  } catch { showToast('Error saving day'); }
+  try { await saveDayToFirestore(currentUser.uid, existing ? existing.firestoreId : key, snapshot); showToast(existing ? 'Day updated in history ✓' : 'Day saved to history! 💾'); }
+  catch { showToast('Error saving day'); }
 };
 
-// ── Tab switching ──────────────────────────────────────────────────────────────
-
-window.switchTab = function(tab) {
-  document.querySelectorAll('.tab').forEach((t, i) =>
-    t.classList.toggle('active', ['add', 'orders', 'daily', 'analytics'][i] === tab));
-  document.querySelectorAll('.page').forEach(p =>
-    p.classList.toggle('active', p.id === `page-${tab}`));
+window.switchTab = function (tab) {
+  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', ['add', 'orders', 'daily', 'analytics'][i] === tab));
+  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${tab}`));
   if (tab === 'analytics') renderAnalytics();
 };
 
-// ── Copy list ──────────────────────────────────────────────────────────────────
-
-window.copyList = function() {
+window.copyList = function () {
   const text = document.getElementById('daily-output').textContent;
-  const btn  = document.getElementById('copy-btn');
-  const reset = () => { btn.textContent = '📋 Copy List'; btn.classList.remove('copy-success'); };
-  navigator.clipboard.writeText(text).then(() => {
-    btn.textContent = '✅ Copied!'; btn.classList.add('copy-success');
-    setTimeout(reset, 2000);
-  }).catch(() => {
-    const ta = document.createElement('textarea');
-    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
-    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
-    showToast('Copied!');
-  });
+  navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
 };
 
-// ── Event listeners ────────────────────────────────────────────────────────────
+function bindOrderFilters() {
+  const q = document.getElementById('order-search');
+  const status = document.getElementById('order-status-filter');
+  const pay = document.getElementById('order-payment-filter');
+  const sort = document.getElementById('order-sort');
+  if (!q || !status || !pay || !sort) return;
+
+  q.addEventListener('input', e => { setOrderFilters({ query: e.target.value.trim().toLowerCase() }); renderAll(); });
+  status.addEventListener('change', e => { setOrderFilters({ status: e.target.value }); renderAll(); });
+  pay.addEventListener('change', e => { setOrderFilters({ payment: e.target.value }); renderAll(); });
+  sort.addEventListener('change', e => { setOrderFilters({ sortBy: e.target.value }); renderAll(); });
+}
 
-// Auth buttons
-document.getElementById('auth-login-btn').addEventListener('click',    window.doLogin);
-document.getElementById('auth-register-btn').addEventListener('click', window.doRegister);
-document.getElementById('auth-login-name').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
-document.getElementById('auth-pw').addEventListener('keydown',         e => { if (e.key === 'Enter') window.doLogin(); });
-document.getElementById('auth-name').addEventListener('keydown',       e => { if (e.key === 'Enter') window.doRegister(); });
-document.getElementById('auth-pw2-new').addEventListener('keydown',    e => { if (e.key === 'Enter') window.doRegister(); });
-document.getElementById('auth-pw2').addEventListener('keydown',        e => { if (e.key === 'Enter') window.doRegister(); });
+function persistFormState() {
+  const data = { selFlavor1, selFlavor2, selTubType, qty1, qty2, selCustomerType };
+  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
+}
+function restoreFormState() {
+  try {
+    const raw = localStorage.getItem(FORM_STORAGE_KEY);
+    if (!raw) {
+      updateTubUI(); updateFlavorUI(); updatePreview();
+      return;
+    }
+    const v = JSON.parse(raw);
+    setSelFlavor1(v.selFlavor1 || null);
+    setSelFlavor2(v.selFlavor2 || null);
+    setSelTubType([1, 2].includes(v.selTubType) ? v.selTubType : null);
+    setQty1(v.qty1 || 1); setQty2(v.qty2 || 1);
+    setSelCustomerType(v.selCustomerType || 'normal');
+  } catch {}
+  updateTubUI(); updateFlavorUI(); updatePreview();
+}
+
+function byId(id) {
+  return document.getElementById(id);
+}
+
+function safeAddEvent(id, event, handler) {
+  byId(id)?.addEventListener(event, handler);
+}
 
-// Auth form toggle links
+// listeners
+safeAddEvent('auth-login-btn', 'click', window.doLogin);
+safeAddEvent('auth-register-btn', 'click', window.doRegister);
+safeAddEvent('auth-login-name', 'keydown', e => { if (e.key === 'Enter') window.doLogin(); });
+safeAddEvent('auth-pw', 'keydown', e => { if (e.key === 'Enter') window.doLogin(); });
+safeAddEvent('auth-name', 'keydown', e => { if (e.key === 'Enter') window.doRegister(); });
+safeAddEvent('auth-pw2-new', 'keydown', e => { if (e.key === 'Enter') window.doRegister(); });
+safeAddEvent('auth-pw2', 'keydown', e => { if (e.key === 'Enter') window.doRegister(); });
 document.querySelector('.auth-link[data-action="register"]')?.addEventListener('click', window.showRegisterForm);
-document.querySelector('.auth-link[data-action="login"]')?.addEventListener('click',    window.showLoginForm);
-
-// App form
-document.getElementById('customer-name').addEventListener('input', updatePreview);
-document.getElementById('tub-btn-1').addEventListener('click', () => selectTubType(1));
-document.getElementById('tub-btn-2').addEventListener('click', () => selectTubType(2));
-document.getElementById('minus-1').addEventListener('click', () => changeQty(1, -1));
-document.getElementById('plus-1').addEventListener('click',  () => changeQty(1,  1));
-document.getElementById('minus-2').addEventListener('click', () => changeQty(2, -1));
-document.getElementById('plus-2').addEventListener('click',  () => changeQty(2,  1));
-document.getElementById('add-btn').addEventListener('click', addOrder);
-
-// Selling-to toggle
-document.getElementById('ctype-normal')?.addEventListener('click',    () => window.setCustomerType('normal'));
-document.getElementById('ctype-reseller')?.addEventListener('click',  () => window.setCustomerType('reseller'));
-
-// Save day + copy
-document.getElementById('save-day-btn')?.addEventListener('click',    window.saveDay);
-document.getElementById('copy-btn')?.addEventListener('click',        window.copyList);
-
-// Logout
-document.getElementById('logout-btn')?.addEventListener('click',      window.doLogout);
-
-// Tabs
-document.querySelectorAll('.tab').forEach(tab => {
-  tab.addEventListener('click', () => window.switchTab(tab.dataset.tab));
-});
-
-// ── Bootstrap ──────────────────────────────────────────────────────────────────
+document.querySelector('.auth-link[data-action="login"]')?.addEventListener('click', window.showLoginForm);
+
+safeAddEvent('customer-name', 'input', () => { persistFormState(); updatePreview(); });
+safeAddEvent('tub-btn-1', 'click', () => selectTubType(1));
+safeAddEvent('tub-btn-2', 'click', () => selectTubType(2));
+safeAddEvent('minus-1', 'click', () => changeQty(1, -1));
+safeAddEvent('plus-1', 'click', () => changeQty(1, 1));
+safeAddEvent('minus-2', 'click', () => changeQty(2, -1));
+safeAddEvent('plus-2', 'click', () => changeQty(2, 1));
+safeAddEvent('add-btn', 'click', addOrder);
+
+document.getElementById('ctype-normal')?.addEventListener('click', () => window.setCustomerType('normal'));
+document.getElementById('ctype-reseller')?.addEventListener('click', () => window.setCustomerType('reseller'));
+safeAddEvent('save-day-btn', 'click', window.saveDay);
+safeAddEvent('copy-btn', 'click', window.copyList);
+safeAddEvent('logout-btn', 'click', window.doLogout);
+document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => window.switchTab(tab.dataset.tab)));
 
 watchAuth(showApp, showAuthScreen);
