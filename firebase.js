// ── firebase.js ────────────────────────────────────────────────────────────────
// All data scoped per-user: users/{uid}/orders  &  users/{uid}/savedDays

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  updateDoc, setDoc, onSnapshot, query, orderBy, where, getDocs,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { setSyncStatus, normalizeOrder } from './utils.js';
import { setOrders, setSavedDays } from './state.js';
import { renderAll } from './render.js';
import { renderAnalytics, updateSaveDayBtn } from './analytics.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAEtm1Jq2WlxLJDe97w0hX20JDFTuhpQdY",
  authDomain:        "cinnabun-tracker.firebaseapp.com",
  projectId:         "cinnabun-tracker",
  storageBucket:     "cinnabun-tracker.firebasestorage.app",
  messagingSenderId: "403071674919",
  appId:             "1:403071674919:web:3612d2be8e68f425a3bc02"
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});

// ── Per-user collection refs ───────────────────────────────────────────────────
const ordersCol    = uid        => collection(db, 'users', uid, 'orders');
const savedDaysCol = uid        => collection(db, 'users', uid, 'savedDays');
const orderRef     = (uid, fid) => doc(db, 'users', uid, 'orders',    fid);
const savedDayRef  = (uid, fid) => doc(db, 'users', uid, 'savedDays', fid);

// ── Listener handles ──────────────────────────────────────────────────────────
let unsubOrders = null;
let unsubDays   = null;

export function stopListeners() {
  if (unsubOrders) { unsubOrders(); unsubOrders = null; }
  if (unsubDays)   { unsubDays();   unsubDays   = null; }
}

export function startOrdersListener(uid) {
  if (unsubOrders) { unsubOrders(); }
  const q = query(ordersCol(uid), orderBy('createdAt', 'asc'));
  // Fallback: always hide loading after 4s even if snapshot doesn't fire
  const hideLoading = () => document.getElementById('loading')?.classList.add('hidden');
  const fallbackTimer = setTimeout(hideLoading, 4000);

  unsubOrders = onSnapshot(q, { includeMetadataChanges: true }, snap => {
    clearTimeout(fallbackTimer);
    const fromServer = !snap.metadata.fromCache;
    setSyncStatus(fromServer ? 'synced' : 'offline', fromServer ? '☁️ Synced' : '📴 Offline');
    setOrders(snap.docs.map(d => normalizeOrder({ firestoreId: d.id, ...d.data() })));
    renderAll();
    hideLoading();
  }, () => {
    clearTimeout(fallbackTimer);
    setSyncStatus('offline', '⚠️ Error');
    hideLoading();
  });
}

export function startDaysListener(uid) {
  if (unsubDays) { unsubDays(); }
  const q = query(savedDaysCol(uid), orderBy('dateKey', 'asc'));
  unsubDays = onSnapshot(q, snap => {
    setSavedDays(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    renderAnalytics();
    updateSaveDayBtn();
  });
}

// ── Write operations (all uid-scoped) ─────────────────────────────────────────
// ── User profile ───────────────────────────────────────────────────────────────
export const saveUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid, 'profile', 'info'), data, { merge: true });

export const getUserProfile = async (uid) => {
  const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
  return snap.exists() ? snap.data() : null;
};

export const addOrderToFirestore         = (uid, data)      => addDoc(ordersCol(uid), data);
export const updateOrderInFirestore      = (uid, fid, data) => updateDoc(orderRef(uid, fid), data);
export const deleteOrderFromFirestore    = (uid, fid)       => deleteDoc(orderRef(uid, fid));
export const saveDayToFirestore          = (uid, key, snap) => setDoc(savedDayRef(uid, key), snap);
export const updateSavedDayInFirestore   = (uid, fid, data) => updateDoc(savedDayRef(uid, fid), data);
export const deleteSavedDayFromFirestore = (uid, fid)       => deleteDoc(savedDayRef(uid, fid));

// ── Look up email by display name ──────────────────────────────────────────────
// Searches users/{uid}/profile/info docs where displayName matches.
// We store a top-level index at nameIndex/{normalizedName} → { email } for fast lookup.
export async function getEmailByName(displayName) {
  const key = displayName.trim().toLowerCase().replace(/\s+/g, '_');
  try {
    const snap = await getDocs(
      query(collection(db, 'nameIndex'), where('nameLower', '==', displayName.trim().toLowerCase()))
    );
    if (!snap.empty) return snap.docs[0].data().email;
  } catch {}
  return null;
}
