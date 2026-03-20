// ── state.js ───────────────────────────────────────────────────────────────────
// Central mutable state shared across modules.

export let orders = [];
export let savedDays = [];

export let selFlavor1 = null;
export let selFlavor2 = null;
export let selTubType = null;
export let qty1 = 1;
export let qty2 = 1;

export let analyticsYear;
export let analyticsMonth;

export let currentUser = null;
export let accountType = null; // 'reseller' | 'main_seller'
export let selCustomerType = 'normal';

export let orderFilters = {
  query: '',
  status: 'all',
  payment: 'all',
  sortBy: 'newest',
};

// Setters
export function setOrders(v) { orders = Array.isArray(v) ? v : []; }
export function setSavedDays(v) { savedDays = Array.isArray(v) ? v : []; }
export function setSelFlavor1(v) { selFlavor1 = v; }
export function setSelFlavor2(v) { selFlavor2 = v; }
export function setSelTubType(v) { selTubType = v; }
export function setQty1(v) { qty1 = Math.max(1, Number(v) || 1); }
export function setQty2(v) { qty2 = Math.max(1, Number(v) || 1); }
export function setAnalyticsYear(v) { analyticsYear = v; }
export function setAnalyticsMonth(v) { analyticsMonth = v; }
export function setCurrentUser(v) { currentUser = v; }
export function setAccountType(v) { accountType = v; }
export function setSelCustomerType(v) { selCustomerType = v === 'reseller' ? 'reseller' : 'normal'; }
export function setOrderFilters(next) {
  orderFilters = { ...orderFilters, ...next };
}
