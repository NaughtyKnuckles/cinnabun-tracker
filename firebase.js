// ── firebase.js ────────────────────────────────────────────────────────────────
// All data scoped per-user: users/{uid}/orders  &  users/{uid}/savedDays

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  updateDoc, setDoc, onSnapshot, query, orderBy,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { setSyncStatus } from './utils.js';
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
  unsubOrders = onSnapshot(q, { includeMetadataChanges: true }, snap => {
    const fromServer = !snap.metadata.fromCache;
    setSyncStatus(fromServer ? 'synced' : 'offline', fromServer ? '☁️ Synced' : '📴 Offline');
    setOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    renderAll();
    document.getElementById('loading').classList.add('hidden');
  }, () => {
    setSyncStatus('offline', '⚠️ Error');
    setTimeout(() => document.getElementById('loading').classList.add('hidden'), 2000);
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
export const addOrderToFirestore         = (uid, data)      => addDoc(ordersCol(uid), data);
export const updateOrderInFirestore      = (uid, fid, data) => updateDoc(orderRef(uid, fid), data);
export const deleteOrderFromFirestore    = (uid, fid)       => deleteDoc(orderRef(uid, fid));
export const saveDayToFirestore          = (uid, key, snap) => setDoc(savedDayRef(uid, key), snap);
export const updateSavedDayInFirestore   = (uid, fid, data) => updateDoc(savedDayRef(uid, fid), data);
export const deleteSavedDayFromFirestore = (uid, fid)       => deleteDoc(savedDayRef(uid, fid));
