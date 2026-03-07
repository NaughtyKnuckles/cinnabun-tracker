// ── utils.js ───────────────────────────────────────────────────────────────────
// App-wide constants, date helpers, toast, and sync-pill helpers.

export const FLAVORS = [
  { name: 'Original',  price: 75, cost: 60 },
  { name: 'Almond',    price: 90, cost: 75 },
  { name: 'Oreo',      price: 90, cost: 75 },
  { name: 'Blueberry', price: 90, cost: 75 },
];

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Date helpers ───────────────────────────────────────────────────────────────

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthKey(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

// ── Sync pill ──────────────────────────────────────────────────────────────────

export function setSyncStatus(state, text) {
  const pill = document.getElementById('sync-pill');
  pill.className = `sync-pill ${state}`;
  pill.querySelector('.sync-dot').className = `sync-dot${state === 'syncing' ? ' pulse' : ''}`;
  document.getElementById('sync-text').textContent = text;
}

// ── Toast ──────────────────────────────────────────────────────────────────────

let toastTimer;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Header date + build timestamp ─────────────────────────────────────────────
// Update BUILD_TIMESTAMP every time you push changes so you can confirm
// the latest code is live in your app.
const BUILD_TIMESTAMP = 'Mar 8, 2026 — 3:04 AM (GMT+8)';

export function setDateHeader() {
  const d = new Date();
  document.getElementById('hdr-day').textContent   = d.getDate();
  document.getElementById('hdr-month').textContent = d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  document.getElementById('hdr-clock').textContent = `Updated — ${BUILD_TIMESTAMP}`;
}
