import { orders, currentUser, accountType, orderFilters } from './state.js';
import { ACCOUNT_TYPE_MAIN_SELLER, todayKey, showToast, ORDER_STATUS_META, ORDER_STATUSES, normalizeOrder } from './utils.js';
import { updateOrderInFirestore, deleteOrderFromFirestore } from './firebase.js';
import { updateSaveDayBtn } from './analytics.js';

export function renderAll() {
  renderSummary();
  renderOrdersList();
  renderDailyList();
  updateSaveDayBtn();
}

function renderSummary() {
  const tod = todayOrders();
  const rev = tod.reduce((s, o) => s + o.revenue, 0);
  const prof = tod.reduce((s, o) => s + o.profit, 0);
  const pcs = tod.reduce((s, o) => s + o.pieces, 0);
  const unpaidAmt = tod.filter(o => !o.paid).reduce((s, o) => s + o.revenue, 0);

  const tally = {};
  tod.forEach(o => {
    tally[o.flavor1] = (tally[o.flavor1] || 0) + o.pieces;
    if (o.flavor2) tally[o.flavor2] = (tally[o.flavor2] || 0) + (o.tubQty || 1);
  });
  const best = Object.keys(tally).length ? Object.keys(tally).reduce((a, b) => tally[a] > tally[b] ? a : b) : '—';

  const isMain = accountType === ACCOUNT_TYPE_MAIN_SELLER;
  document.getElementById('sum-revenue').textContent = `₱${rev}`;
  document.getElementById('sum-profit').textContent = isMain ? '—' : `₱${prof}`;
  document.getElementById('sum-pieces').textContent = pcs;
  document.getElementById('sum-best').textContent = best;
  document.getElementById('sum-unpaid').textContent = `₱${unpaidAmt}`;
}

function getFilteredOrders() {
  const filtered = todayOrders().filter(o => {
    if (orderFilters.status !== 'all' && o.status !== orderFilters.status) return false;
    if (orderFilters.payment === 'paid' && !o.paid) return false;
    if (orderFilters.payment === 'unpaid' && o.paid) return false;
    if (orderFilters.query) {
      const haystack = `${o.customer || ''} ${o.flavor1 || ''} ${o.flavor2 || ''}`.toLowerCase();
      if (!haystack.includes(orderFilters.query)) return false;
    }
    return true;
  });

  const sorted = filtered.slice();
  switch (orderFilters.sortBy) {
    case 'oldest': sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
    case 'price_desc': sorted.sort((a, b) => b.revenue - a.revenue); break;
    case 'price_asc': sorted.sort((a, b) => a.revenue - b.revenue); break;
    case 'customer_asc': sorted.sort((a, b) => (a.customer || '').localeCompare(b.customer || '')); break;
    default: sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return sorted;
}

function orderCardHTML(o) {
  const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.pending;
  const flavorLabel = o.mixed ? `${o.flavor1} + ${o.flavor2}` : o.flavor1;
  const tubLabel = `${o.tubQty}×${o.tubType}pc tub${o.tubQty > 1 ? 's' : ''}`;

  return `<div class="order-item status-${o.status}${o.paid ? ' paid-item' : ''}">
    <div class="order-top">
      <div class="order-info">
        <div class="order-name">${flavorLabel} <span class="status-chip">${meta.emoji} ${meta.label}</span></div>
        ${o.customer ? `<div class="order-customer">👤 ${o.customer}</div>` : ''}
        <div class="order-meta">${tubLabel} · ${o.pieces}pc · ${o.time}</div>
      </div>
      <div class="order-prices"><div class="order-revenue">₱${o.revenue}</div>${accountType !== ACCOUNT_TYPE_MAIN_SELLER ? `<div class="order-profit">+₱${o.profit}</div>` : ''}</div>
      <button class="del-btn" onclick="deleteOrder('${o.firestoreId}')">✕</button>
    </div>
    <div class="order-controls-grid">
      <select class="status-select" onchange="setOrderStatus('${o.firestoreId}', this.value)">
        ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${ORDER_STATUS_META[s].emoji} ${ORDER_STATUS_META[s].label}</option>`).join('')}
      </select>
      <button class="pay-btn ${o.paid ? 'active-cash' : ''}" onclick="togglePaid('${o.firestoreId}', ${o.paid})">${o.paid ? '✅ Paid' : '💸 Mark Paid'}</button>
      <button class="delivery-btn ${o.status === 'delivered' ? 'delivered-active' : ''}" onclick="setOrderStatus('${o.firestoreId}','delivered')">🚚 Deliver</button>
      <button class="day-edit-btn" onclick="editOrder('${o.firestoreId}')">✏️ Edit</button>
    </div>
  </div>`;
}

function renderOrdersList() {
  const list = document.getElementById('orders-list');
  const title = document.getElementById('all-orders-title');
  const data = getFilteredOrders();
  title.textContent = `Today's Orders (${data.length})`;
  if (!data.length) {
    list.innerHTML = '<div class="orders-empty"><div class="empty-icon">🔎</div><p>No matching orders found.</p></div>';
    return;
  }
  list.innerHTML = data.map(orderCardHTML).join('');
}

function renderDailyList() {
  const tod = todayOrders();
  const out = document.getElementById('daily-output');
  if (!tod.length) return (out.textContent = 'No orders yet today.');

  const lines = [];
  lines.push(`🍩 CinnaBun Orders — ${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}`, '');
  tod.forEach(o => lines.push(`• ${o.customer || 'Walk-in'}: ${o.mixed ? `${o.flavor1} + ${o.flavor2}` : o.flavor1} (${o.pieces}pc) - ₱${o.revenue} [${ORDER_STATUS_META[o.status].label}]`));

  const rev = tod.reduce((s, o) => s + o.revenue, 0);
  const pcs = tod.reduce((s, o) => s + o.pieces, 0);
  lines.push('', `Total: ${pcs} pcs | Revenue: ₱${rev}`);
  out.textContent = lines.join('\n');
}

export function todayOrders() {
  return orders.map(normalizeOrder).filter(o => o.date === todayKey());
}

window.setOrderStatus = async function (fid, status) {
  const uid = currentUser?.uid;
  if (!uid) return;
  if (!ORDER_STATUSES.includes(status)) return showToast('Invalid status');
  try { await updateOrderInFirestore(uid, fid, { status, delivered: status === 'delivered' }); showToast('Status updated'); }
  catch { showToast('Status update failed'); }
};

window.togglePaid = async function (fid, currentPaid) {
  const uid = currentUser?.uid;
  if (!uid) return;
  const nextPaid = !currentPaid;
  try { await updateOrderInFirestore(uid, fid, { paid: nextPaid, payMethod: nextPaid ? 'cash' : null }); showToast(nextPaid ? 'Marked paid' : 'Marked unpaid'); }
  catch { showToast('Payment update failed'); }
};

window.editOrder = async function (fid) {
  const uid = currentUser?.uid;
  if (!uid) return;
  const target = orders.find(o => o.firestoreId === fid);
  if (!target) return;

  const customer = prompt('Customer name:', target.customer || '') ?? target.customer;
  const tubQty = Number(prompt('Tub quantity:', String(target.tubQty || 1)));
  if (!Number.isFinite(tubQty) || tubQty < 1) return showToast('Quantity must be at least 1');

  const updated = normalizeOrder({ ...target, customer: customer.trim(), tubQty, pieces: target.tubType * tubQty, revenue: (target.revenue / (target.tubQty || 1)) * tubQty, profit: (target.profit / (target.tubQty || 1)) * tubQty });
  try {
    await updateOrderInFirestore(uid, fid, {
      customer: updated.customer,
      tubQty: updated.tubQty,
      pieces: updated.pieces,
      revenue: Math.round(updated.revenue),
      profit: Math.round(updated.profit),
    });
    showToast('Order updated');
  } catch { showToast('Update failed'); }
};

window.deleteOrder = async function (fid) {
  const uid = currentUser?.uid;
  if (!uid) return;
  if (!confirm('Delete this order?')) return;
  try { await deleteOrderFromFirestore(uid, fid); showToast('Order removed'); }
  catch { showToast('Delete failed'); }
};
