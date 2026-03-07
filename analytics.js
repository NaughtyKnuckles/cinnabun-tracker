// ── analytics.js ───────────────────────────────────────────────────────────────
// Renders the Analytics tab: monthly stats, revenue chart,
// tub-type breakdown, and day history cards with inline editing.

import { savedDays, analyticsYear, analyticsMonth, setAnalyticsYear, setAnalyticsMonth } from './state.js';
import { MONTH_NAMES, monthKey, todayKey, showToast } from './utils.js';
import { updateSavedDayInFirestore, deleteSavedDayFromFirestore } from './firebase.js';

export function renderAnalytics() {
  const mk = monthKey(analyticsYear, analyticsMonth);
  document.getElementById('month-label').textContent       = `${MONTH_NAMES[analyticsMonth]} ${analyticsYear}`;
  document.getElementById('chart-month-label').textContent = `${MONTH_NAMES[analyticsMonth].slice(0, 3)} ${analyticsYear}`;

  const monthDays = savedDays.filter(d => d.month === mk);
  document.getElementById('m-revenue').textContent = `₱${monthDays.reduce((s, d) => s + d.revenue, 0)}`;
  document.getElementById('m-profit').textContent  = `₱${monthDays.reduce((s, d) => s + d.profit, 0)}`;
  document.getElementById('m-orders').textContent  = monthDays.reduce((s, d) => s + d.orderCount, 0);
  document.getElementById('m-pieces').textContent  = monthDays.reduce((s, d) => s + d.pieces, 0);

  renderRevenueChart(monthDays);
  renderPieceBreakdown(monthDays);
  renderDayHistory(monthDays);
}

// ── Revenue chart ──────────────────────────────────────────────────────────────

function renderRevenueChart(days) {
  const chart = document.getElementById('revenue-chart');
  if (!days.length) {
    chart.innerHTML = `<span style="color:var(--muted);font-size:11px;margin:auto">No saved days this month</span>`;
    return;
  }
  const maxRev = Math.max(...days.map(d => d.revenue), 1);
  chart.innerHTML = days.map(d => {
    const h      = Math.max(4, Math.round((d.revenue / maxRev) * 76));
    const dayNum = parseInt(d.dateKey.split('-')[2]);
    return `<div class="bar-col">
      <div class="bar-val">₱${d.revenue >= 1000 ? (d.revenue / 1000).toFixed(1) + 'k' : d.revenue}</div>
      <div class="bar" style="height:${h}px;background:linear-gradient(180deg,var(--amber2),var(--amber))"></div>
      <div class="bar-label">${dayNum}</div>
    </div>`;
  }).join('');
}

// ── Tub-type breakdown ─────────────────────────────────────────────────────────

function renderPieceBreakdown(days) {
  const container = document.getElementById('piece-breakdown-rows');
  if (!days.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0">No data for this month.</div>`;
    return;
  }
  const totals = {};
  days.forEach(d => {
    if (d.pieceCounts) Object.keys(d.pieceCounts).forEach(pc => {
      totals[pc] = (totals[pc] || 0) + d.pieceCounts[pc];
    });
  });
  const sorted = Object.keys(totals).sort((a, b) => parseInt(a) - parseInt(b));
  if (!sorted.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0">No tub data.</div>`;
    return;
  }
  const maxVal    = Math.max(...Object.values(totals), 1);
  const totalTubs = Object.values(totals).reduce((s, v) => s + v, 0);
  container.innerHTML = sorted.map(pc => {
    const cnt = totals[pc];
    const w   = Math.round((cnt / maxVal) * 100);
    const pct = Math.round((cnt / totalTubs) * 100);
    return `<div class="piece-row">
      <div class="piece-tag">${pc}pc</div>
      <div class="piece-bar-wrap"><div class="piece-bar-fill" style="width:${w}%"></div></div>
      <div class="piece-count">${cnt} tubs</div>
      <div class="piece-orders-count">${pct}%</div>
    </div>`;
  }).join('');
}

// ── Day history cards ──────────────────────────────────────────────────────────

function renderDayHistory(days) {
  const container = document.getElementById('day-history-list');
  if (!days.length) {
    container.innerHTML = `<div class="hist-empty"><div class="empty-icon">📊</div><p>No saved days yet.<br>Use "Save Today to History"<br>on the Add tab.</p></div>`;
    return;
  }
  const sorted = [...days].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  container.innerHTML = sorted.map(d => buildDayCardHTML(d)).join('');
}

// Builds the VIEW state of a day card
function buildDayCardHTML(d) {
  const parts     = d.dateKey.split('-');
  const dateObj   = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const dateLabel = dateObj.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const pcEntries = d.pieceCounts
    ? Object.keys(d.pieceCounts).sort((a, b) => parseInt(a) - parseInt(b))
        .map(pc => `<div class="day-detail-row"><span>${pc}pc tubs sold</span><span>${d.pieceCounts[pc]}</span></div>`).join('')
    : '';

  return `<div class="day-card" data-fid="${d.firestoreId}" data-datekey="${d.dateKey}">
    <div class="day-card-header" onclick="toggleDay(this)">
      <div class="day-date">${dateLabel}</div>
      <div class="day-summary">
        <div class="day-rev">₱${d.revenue}</div>
        <div class="day-prof">+₱${d.profit}</div>
      </div>
      <span class="day-chevron">▼</span>
    </div>
    <div class="day-body">
      <div class="day-detail-row"><span>Orders</span><span>${d.orderCount}</span></div>
      <div class="day-detail-row"><span>Pieces Sold</span><span>${d.pieces}</span></div>
      <div class="day-detail-row"><span>Revenue</span><span>₱${d.revenue}</span></div>
      <div class="day-detail-row"><span>Profit</span><span>₱${d.profit}</span></div>
      <div class="day-detail-row"><span>Cash Collected</span><span>₱${d.cashAmt || 0}</span></div>
      <div class="day-detail-row"><span>GCash Collected</span><span>₱${d.gcashAmt || 0}</span></div>
      <div class="day-detail-row"><span>Unpaid at Save</span><span style="color:${d.unpaidAmt ? 'var(--red)' : 'var(--green)'}">₱${d.unpaidAmt || 0}</span></div>
      <div class="day-detail-row"><span>Best Flavor</span><span>${d.bestFlavor || '—'}</span></div>
      ${pcEntries}
      <div class="day-card-actions">
        <button class="day-edit-btn" onclick="editDay('${d.firestoreId}')">✏️ Edit</button>
        <button class="day-delete-btn" onclick="deleteDay('${d.firestoreId}')">🗑 Delete</button>
      </div>
    </div>
  </div>`;
}

// Builds the EDIT state — replaces day-body content in-place
function buildDayEditHTML(d) {
  const pieceCounts = d.pieceCounts || {};
  const pcFields = Object.keys(pieceCounts).sort((a, b) => parseInt(a) - parseInt(b))
    .map(pc => `
      <div class="day-edit-row">
        <label>${pc}pc tubs sold</label>
        <input class="day-edit-input" type="number" min="0" data-field="pc_${pc}" value="${pieceCounts[pc]}"/>
      </div>`).join('');

  return `<div class="day-edit-form" data-fid="${d.firestoreId}">
    <div class="day-edit-row">
      <label>Orders</label>
      <input class="day-edit-input" type="number" min="0" data-field="orderCount" value="${d.orderCount}"/>
    </div>
    <div class="day-edit-row">
      <label>Pieces Sold</label>
      <input class="day-edit-input" type="number" min="0" data-field="pieces" value="${d.pieces}"/>
    </div>
    <div class="day-edit-row">
      <label>Revenue (₱)</label>
      <input class="day-edit-input" type="number" min="0" data-field="revenue" value="${d.revenue}"/>
    </div>
    <div class="day-edit-row">
      <label>Profit (₱)</label>
      <input class="day-edit-input" type="number" min="0" data-field="profit" value="${d.profit}"/>
    </div>
    <div class="day-edit-row">
      <label>Cash Collected (₱)</label>
      <input class="day-edit-input" type="number" min="0" data-field="cashAmt" value="${d.cashAmt || 0}"/>
    </div>
    <div class="day-edit-row">
      <label>GCash Collected (₱)</label>
      <input class="day-edit-input" type="number" min="0" data-field="gcashAmt" value="${d.gcashAmt || 0}"/>
    </div>
    <div class="day-edit-row">
      <label>Unpaid at Save (₱)</label>
      <input class="day-edit-input" type="number" min="0" data-field="unpaidAmt" value="${d.unpaidAmt || 0}"/>
    </div>
    <div class="day-edit-row">
      <label>Best Flavor</label>
      <input class="day-edit-input" type="text" data-field="bestFlavor" value="${d.bestFlavor || ''}"/>
    </div>
    ${pcFields}
    <div class="day-edit-actions">
      <button class="day-save-btn" onclick="saveDayEdit('${d.firestoreId}')">💾 Save Changes</button>
      <button class="day-cancel-btn" onclick="cancelDayEdit('${d.firestoreId}')">✕ Cancel</button>
    </div>
  </div>`;
}

// ── Window-level handlers ──────────────────────────────────────────────────────

window.toggleDay = function(header) {
  const body = header.nextElementSibling;
  // Don't collapse while editing
  if (body.querySelector('.day-edit-form')) return;
  const chevron = header.querySelector('.day-chevron');
  chevron.classList.toggle('open', body.classList.toggle('open'));
};

window.editDay = function(fid) {
  const d = savedDays.find(d => d.firestoreId === fid);
  if (!d) return;
  const card    = document.querySelector(`.day-card[data-fid="${fid}"]`);
  const body    = card.querySelector('.day-body');
  const chevron = card.querySelector('.day-chevron');
  body.classList.add('open');
  chevron.classList.add('open');
  body.innerHTML = buildDayEditHTML(d);
};

window.cancelDayEdit = function(fid) {
  const d = savedDays.find(d => d.firestoreId === fid);
  if (!d) return;
  const card = document.querySelector(`.day-card[data-fid="${fid}"]`);
  // Replace entire card with fresh view, then re-open
  card.outerHTML = buildDayCardHTML(d);
  const newCard = document.querySelector(`.day-card[data-fid="${fid}"]`);
  newCard.querySelector('.day-body').classList.add('open');
  newCard.querySelector('.day-chevron').classList.add('open');
};

window.saveDayEdit = async function(fid) {
  const d = savedDays.find(d => d.firestoreId === fid);
  if (!d) return;

  const form   = document.querySelector(`.day-edit-form[data-fid="${fid}"]`);
  const inputs = form.querySelectorAll('.day-edit-input');
  const updates  = {};
  const newPc    = { ...(d.pieceCounts || {}) };

  inputs.forEach(input => {
    const field = input.dataset.field;
    if (field.startsWith('pc_')) {
      newPc[field.slice(3)] = parseInt(input.value) || 0;
    } else if (field === 'bestFlavor') {
      updates[field] = input.value.trim() || '—';
    } else {
      updates[field] = parseInt(input.value) || 0;
    }
  });
  updates.pieceCounts = newPc;

  const saveBtn       = form.querySelector('.day-save-btn');
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';

  try {
    await updateSavedDayInFirestore(fid, updates);
    showToast('Day updated ✓');
    // Firestore onSnapshot will re-render the list automatically
  } catch {
    showToast('Error saving changes');
    saveBtn.disabled    = false;
    saveBtn.textContent = '💾 Save Changes';
  }
};

window.deleteDay = async function(fid) {
  if (!confirm('Delete this saved day? This cannot be undone.')) return;
  try {
    await deleteSavedDayFromFirestore(fid);
    showToast('Day deleted');
  } catch {
    showToast('Error deleting day');
  }
};

window.changeMonth = function(dir) {
  let m = analyticsMonth + dir;
  let y = analyticsYear;
  if (m > 11) { m = 0; y++; }
  if (m < 0)  { m = 11; y--; }
  setAnalyticsMonth(m);
  setAnalyticsYear(y);
  renderAnalytics();
};

// ── Save day button label ──────────────────────────────────────────────────────

export function updateSaveDayBtn() {
  const key   = todayKey();
  const saved = savedDays.find(d => d.dateKey === key);
  document.getElementById('save-day-label').textContent =
    saved ? '✅ Today is saved — tap to update' : 'Save Today to History';
}
