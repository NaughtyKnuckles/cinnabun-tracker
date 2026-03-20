 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/utils.js b/utils.js
index 84c98ead9875b0dd7bbe6e7dfc8146c11e920761..ca523fadecbb929746d19767d481aac27553690f 100644
--- a/utils.js
+++ b/utils.js
@@ -1,69 +1,84 @@
 // ── utils.js ───────────────────────────────────────────────────────────────────
-// App-wide constants, date helpers, toast, and sync-pill helpers.
 
-// Retail prices — for normal (end) customers
-export const FLAVORS = [
-  { name: 'Original',  price: 75, cost: 45 },
-  { name: 'Almond',    price: 90, cost: 60 },
-  { name: 'Oreo',      price: 90, cost: 60 },
-  { name: 'Blueberry', price: 90, cost: 60 },
-];
+export const ACCOUNT_TYPE_RESELLER = 'reseller';
+export const ACCOUNT_TYPE_MAIN_SELLER = 'main_seller';
+
+export const ORDER_STATUSES = ['pending', 'baking', 'ready', 'delivered'];
+export const ORDER_STATUS_META = {
+  pending: { label: 'Pending', emoji: '🕒' },
+  baking: { label: 'Baking', emoji: '🔥' },
+  ready: { label: 'Ready', emoji: '✅' },
+  delivered: { label: 'Delivered', emoji: '🚚' },
+};
 
-// Reseller prices — what you charge reseller customers
-export const RESELLER_FLAVORS = [
-  { name: 'Original',  price: 60, cost: 45 },
-  { name: 'Almond',    price: 75, cost: 60 },
-  { name: 'Oreo',      price: 75, cost: 60 },
-  { name: 'Blueberry', price: 75, cost: 60 },
+export const FLAVORS = [
+  { name: 'Original', price: 75, resellerPrice: 60, cost: 45 },
+  { name: 'Almond', price: 90, resellerPrice: 75, cost: 60 },
+  { name: 'Oreo', price: 90, resellerPrice: 75, cost: 60 },
+  { name: 'Blueberry', price: 90, resellerPrice: 75, cost: 60 },
 ];
 
-/** Returns the correct flavor list based on customer type */
-export function getFlavors(customerType) {
-  return customerType === 'reseller' ? RESELLER_FLAVORS : FLAVORS;
+export function flavorPrice(flavor, customerType = 'normal') {
+  if (!flavor) return 0;
+  return customerType === 'reseller' ? flavor.resellerPrice : flavor.price;
 }
 
 export const MONTH_NAMES = [
-  'January','February','March','April','May','June',
-  'July','August','September','October','November','December'
+  'January', 'February', 'March', 'April', 'May', 'June',
+  'July', 'August', 'September', 'October', 'November', 'December',
 ];
 
-// ── Date helpers ───────────────────────────────────────────────────────────────
-
 export function todayKey() {
   const d = new Date();
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 }
 
 export function monthKey(y, m) {
   return `${y}-${String(m + 1).padStart(2, '0')}`;
 }
 
-// ── Sync pill ──────────────────────────────────────────────────────────────────
-
 export function setSyncStatus(state, text) {
   const pill = document.getElementById('sync-pill');
+  if (!pill) return;
   pill.className = `sync-pill ${state}`;
-  pill.querySelector('.sync-dot').className = `sync-dot${state === 'syncing' ? ' pulse' : ''}`;
-  document.getElementById('sync-text').textContent = text;
+  const dot = pill.querySelector('.sync-dot');
+  if (dot) dot.className = `sync-dot${state === 'syncing' ? ' pulse' : ''}`;
+  const label = document.getElementById('sync-text');
+  if (label) label.textContent = text;
 }
 
-// ── Toast ──────────────────────────────────────────────────────────────────────
-
 let toastTimer;
 export function showToast(msg) {
   const t = document.getElementById('toast');
+  if (!t) return;
   t.textContent = msg;
   t.classList.add('show');
   clearTimeout(toastTimer);
   toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
 }
 
-// ── Header date + build timestamp ─────────────────────────────────────────────
-// Update BUILD_TIMESTAMP every time you push changes so you can confirm
-// the latest code is live in your app.
-const BUILD_TIMESTAMP = 'Mar 8, 2026 — 4:34 PM (GMT+8)'port function setDateHeader() {
+const BUILD_TIMESTAMP = 'Mar 20, 2026 — 2:24 PM (GMT+8)';
+
+export function setDateHeader() {
   const d = new Date();
-  document.getElementById('hdr-day').textContent   = d.getDate();
-  document.getElementById('hdr-month').textContent = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
-  document.getElementById('hdr-clock').textContent = `Updated — ${BUILD_TIMESTAMP}`;
+  const day = document.getElementById('hdr-day');
+  const month = document.getElementById('hdr-month');
+  const clock = document.getElementById('hdr-clock');
+  if (day) day.textContent = d.getDate();
+  if (month) month.textContent = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
+  if (clock) clock.textContent = `Updated — ${BUILD_TIMESTAMP}`;
+}
+
+export function normalizeOrder(order) {
+  const status = order.status || (order.delivered ? 'delivered' : 'pending');
+  return {
+    ...order,
+    status: ORDER_STATUSES.includes(status) ? status : 'pending',
+    tubQty: Math.max(1, Number(order.tubQty) || 1),
+    pieces: Math.max(1, Number(order.pieces) || Number(order.tubType) || 1),
+    revenue: Math.max(0, Number(order.revenue) || 0),
+    profit: Math.max(0, Number(order.profit) || 0),
+    customer: (order.customer || '').trim(),
+    customerType: order.customerType === 'reseller' ? 'reseller' : 'normal',
+  };
 }
 
EOF
)