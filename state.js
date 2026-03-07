// ── state.js ───────────────────────────────────────────────────────────────────
// Central mutable state shared across modules.

export let orders     = [];
export let savedDays  = [];

export let selFlavor1 = null;
export let selFlavor2 = null;
export let selTubType = null; // 1 or 2
export let qty1       = 1;
export let qty2       = 1;

export let analyticsYear;
export let analyticsMonth;

// Setters
export function setOrders(v)        { orders      = v; }
export function setSavedDays(v)     { savedDays   = v; }
export function setSelFlavor1(v)    { selFlavor1  = v; }
export function setSelFlavor2(v)    { selFlavor2  = v; }
export function setSelTubType(v)    { selTubType  = v; }
export function setQty1(v)          { qty1        = v; }
export function setQty2(v)          { qty2        = v; }
export function setAnalyticsYear(v) { analyticsYear  = v; }
export function setAnalyticsMonth(v){ analyticsMonth = v; }
