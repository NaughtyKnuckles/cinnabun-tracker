// ── analytics.js ───────────────────────────────────────────────────────────────
// Renders the Analytics tab: monthly stats, revenue chart,
// tub-type breakdown, and day history cards.

import { savedDays, analyticsYear, analyticsMonth, setAnalyticsYear, setAnalyticsMonth } from './state.js';
import { MONTH_NAMES, monthKey, todayKey } from './utils.js';

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

function renderDayHistory(days) {
  const container = document.getElementById('day-history-list');
  if (!days.length) {
    container.innerHTML = `<div class="hist-empty"><div class="empty-icon">📊</div><p>No saved days yet.<br>Use "Save Today to History"<br>on the Add tab.</p></div>`;
    return;
  }
  const sorted = [...days].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  container.innerHTML = sorted.map(d => {
    const parts    = d.dateKey.split('-');
    const dateObj  = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dateLabel = dateObj.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
    const pcEntries = d.pieceCounts
      ? Object.keys(d.pieceCounts).sort((a, b) => parseInt(a) - parseInt(b))
          .map(pc => `<div class="day-detail-row"><span>${pc}pc tubs sold</span><span>${d.pieceCounts[pc]}</span></div>`).join('')
      : '';
    return `<div class="day-card">
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
      </div>
    </div>`;
  }).join('');
}

export function updateSaveDayBtn() {
  const key   = todayKey();
  const saved = savedDays.find(d => d.dateKey === key);
  document.getElementById('save-day-label').textContent =
    saved ? '✅ Today is saved — tap to update' : 'Save Today to History';
}

// ── Window-level handlers used by inline onclick ───────────────────────────────

window.toggleDay = function(header) {
  const body    = header.nextElementSibling;
  const chevron = header.querySelector('.day-chevron');
  chevron.classList.toggle('open', body.classList.toggle('open'));
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
