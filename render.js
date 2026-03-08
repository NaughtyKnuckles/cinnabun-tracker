// ── render.js ──────────────────────────────────────────────────────────────────
// Reads state, updates DOM. Covers: summary stats, orders list, daily share list.

import { orders, currentUser, accountType } from './state.js';
import { ACCOUNT_TYPE_SELLER } from './utils.js';
import { todayKey, showToast } from './utils.js';
import { updateOrderInFirestore, deleteOrderFromFirestore } from './firebase.js';
import { updateSaveDayBtn } from './analytics.js';

export function renderAll() {
  renderSummary();
  renderOrdersList();
  renderDailyList();
  updateSaveDayBtn();
}

// ── Summary stats ──────────────────────────────────────────────────────────────

function renderSummary() {
  const tod       = todayOrders();
  const rev       = tod.reduce((s, o) => s + o.revenue, 0);
  const prof      = tod.reduce((s, o) => s + o.profit, 0);
  const pcs       = tod.reduce((s, o) => s + o.pieces, 0);
  const unpaidAmt = tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0);

  const tally = {};
  tod.forEach(o => {
    tally[o.flavor1] = (tally[o.flavor1] || 0) + o.pieces;
    if (o.flavor2) tally[o.flavor2] = (tally[o.flavor2] || 0) + (o.tubQty || 1);
  });
  const best = Object.keys(tally).length
    ? Object.keys(tally).reduce((a, b) => tally[a] > tally[b] ? a : b)
    : '—';

  const isSeller = accountType === ACCOUNT_TYPE_SELLER;
  document.getElementById('sum-revenue').textContent = `₱${rev}`;
  document.getElementById('sum-profit').textContent  = isSeller ? '—' : `₱${prof}`;
  document.getElementById('sum-pieces').textContent  = pcs;
  document.getElementById('sum-best').textContent    = best;
  document.getElementById('sum-unpaid').textContent  = `₱${unpaidAmt}`;
  // Show/hide profit stat card
  document.querySelectorAll('.stat.profit').forEach(el => el.style.display = isSeller ? 'none' : '');
}

// ── Orders list ────────────────────────────────────────────────────────────────

function orderCardHTML(o) {
  const tubType     = o.tubType || o.pieces;
  const tubQty      = o.tubQty || 1;
  const flavorLabel = o.mixed ? `${o.flavor1} + ${o.flavor2}` : o.flavor1;
  const tubLabel    = o.mixed
    ? `${tubQty}×2pc mixed tub${tubQty > 1 ? 's' : ''}`
    : `${tubQty}×${tubType}pc tub${tubQty > 1 ? 's' : ''}`;
  const meta  = `${tubLabel} · ${o.pieces}pc total · ${o.time}`;
  const ctBadge = o.customerType === 'reseller'
    ? `<span class="order-ctype reseller-ctype">🔄 Reseller</span>`
    : `<span class="order-ctype normal-ctype">👤 Normal</span>`;
  const isSeller = accountType === ACCOUNT_TYPE_SELLER;
  const cHTML = o.customer ? `<div class="order-customer">👤 ${o.customer}</div>` : '';
  const pm    = o.payMethod || null;
  const badge = o.paid
    ? `<span class="paid-badge ${pm}">${pm === 'cash' ? '💵 Cash' : '💙 GCash'}</span>`
    : `<span class="unpaid-badge">UNPAID</span>`;

  const delivered = !!o.delivered;
  return `<div class="order-item${o.mixed ? ' mixed-item' : ''}${o.paid ? ' paid-item' : ''}${o.delivered ? ' delivered-item' : ''}">
    <div class="order-top">
      <div class="order-dot"></div>
      <div class="order-info">
        <div class="order-name">${flavorLabel} ${ctBadge}</div>${cHTML}
        <div class="order-meta">${meta}</div>
      </div>
      <div class="order-prices">
        <div class="order-revenue">₱${o.revenue}</div>
        ${!isSeller ? `<div class="order-profit">+₱${o.profit}</div>` : ''}
      </div>
      <div class="order-top-right">
        ${delivered ? '<span class="delivered-badge">🚚 Delivered</span>' : ''}
        <button class="del-btn" onclick="deleteOrder('${o.firestoreId}')">✕</button>
      </div>
    </div>
    <div class="order-bottom">
      <button class="pay-btn cash ${pm === 'cash' ? 'active-cash' : ''}" onclick="markPayment('${o.firestoreId}','cash','${pm}')">💵 Cash</button>
      <button class="pay-btn gcash ${pm === 'gcash' ? 'active-gcash' : ''}" onclick="markPayment('${o.firestoreId}','gcash','${pm}')">💙 GCash</button>
      ${badge}
    </div>
    <div class="order-delivery-row">
      <button class="delivery-btn ${delivered ? 'delivered-active' : ''}" onclick="toggleDelivered('${o.firestoreId}',${delivered})">
        ${delivered ? '✅ Delivered' : '🚚 Mark as Delivered'}
      </button>
    </div>
  </div>`;
}

function renderOrdersList() {
  const tod  = todayOrders().slice().reverse();
  const us   = document.getElementById('unpaid-section');
  const at   = document.getElementById('all-orders-title');
  const list = document.getElementById('orders-list');

  if (!tod.length) {
    us.innerHTML   = '';
    at.textContent = "Today's Orders";
    list.innerHTML = `<div class="orders-empty"><div class="empty-icon">🍩</div><p>No orders yet today.<br>Add your first one!</p></div>`;
    return;
  }

  const unpaid = tod.filter(o => !o.paid);
  us.innerHTML = unpaid.length
    ? `<div class="section-label">⚠️ Unpaid (${unpaid.length})</div>${unpaid.map(orderCardHTML).join('')}`
    : `<div class="section-label" style="color:var(--green)">✅ All paid for today!</div>`;

  at.textContent = `All Orders (${tod.length})`;
  list.innerHTML = tod.map(orderCardHTML).join('');
}

// ── Daily share list ───────────────────────────────────────────────────────────

function renderDailyList() {
  const tod = todayOrders();
  const out = document.getElementById('daily-output');
  if (!tod.length) { out.textContent = 'No orders yet today.'; return; }

  const lines   = [];
  const dateStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
  lines.push(`🍩 CinnaBun Orders — ${dateStr}`, '');

  const byTub = {};
  tod.forEach(o => {
    const tt = o.tubType || o.pieces;
    if (!byTub[tt]) byTub[tt] = { single: {}, mixed: {} };
    if (o.mixed) {
      const pair = [o.flavor1, o.flavor2].sort().join(' + ');
      byTub[tt].mixed[pair] = (byTub[tt].mixed[pair] || 0) + (o.tubQty || 1);
    } else {
      byTub[tt].single[o.flavor1] = (byTub[tt].single[o.flavor1] || 0) + (o.tubQty || 1);
    }
  });

  Object.keys(byTub).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tt => {
    lines.push(`${tt}pc tubs:`);
    Object.keys(byTub[tt].single).forEach(fl => lines.push(`  ${fl} - ${byTub[tt].single[fl]}`));
    Object.keys(byTub[tt].mixed).forEach(pair => lines.push(`  ${pair} - ${byTub[tt].mixed[pair]}`));
    lines.push('');
  });

  const unpaid    = tod.filter(o => !o.paid);
  const rev       = tod.reduce((s, o) => s + o.revenue, 0);
  const prof      = tod.reduce((s, o) => s + o.profit, 0);
  const pcs       = tod.reduce((s, o) => s + o.pieces, 0);
  const cashAmt   = tod.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.revenue, 0);
  const gcashAmt  = tod.filter(o => o.payMethod === 'gcash').reduce((s, o) => s + o.revenue, 0);
  const unpaidAmt = unpaid.reduce((s, o) => s + o.revenue, 0);

  lines.push(`Total: ${pcs} pcs | Revenue: ₱${rev} | Profit: ₱${prof}`, '', '💳 Payment Breakdown:');
  if (cashAmt)   lines.push(`  💵 Cash:   ₱${cashAmt}`);
  if (gcashAmt)  lines.push(`  💙 GCash:  ₱${gcashAmt}`);
  if (unpaidAmt) lines.push(`  ⚠️  Unpaid: ₱${unpaidAmt} (${unpaid.length} order${unpaid.length > 1 ? 's' : ''})`);
  const unames = unpaid.filter(o => o.customer).map(o => o.customer);
  if (unames.length) lines.push(`     → ${unames.join(', ')}`);

  out.textContent = lines.join('\n');
}

// ── Exported helpers ───────────────────────────────────────────────────────────

export function todayOrders() {
  return orders.filter(o => o.date === todayKey());
}

// Inline onclick handlers — need window scope, use currentUser for uid

window.markPayment = async function(fid, method, cur) {
  const uid = currentUser?.uid;
  if (!uid) return;
  const nm = cur === method ? null : method;
  try {
    await updateOrderInFirestore(uid, fid, { paid: nm !== null, payMethod: nm });
    showToast(nm ? `Marked as ${nm} ✓` : 'Marked as unpaid');
  } catch { showToast('Error updating payment'); }
};

window.toggleDelivered = async function(fid, cur) {
  const uid = currentUser?.uid;
  if (!uid) return;
  try {
    await updateOrderInFirestore(uid, fid, { delivered: !cur });
    showToast(!cur ? '🚚 Marked as delivered!' : 'Delivery status cleared');
  } catch { showToast('Error'); }
};

window.deleteOrder = async function(fid) {
  const uid = currentUser?.uid;
  if (!uid) return;
  try { await deleteOrderFromFirestore(uid, fid); showToast('Order removed'); }
  catch { showToast('Error'); }
};
