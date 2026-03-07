// ── firebase.js ────────────────────────────────────────────────────────────────
// Firebase initialisation and Firestore real-time listeners.
// Exports: db, startOrdersListener, startDaysListener

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  updateDoc, setDoc, onSnapshot, query, orderBy,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { setSyncStatus } from './utils.js';
import { orders, savedDays, setOrders, setSavedDays } from './state.js';
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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});

export function startOrdersListener() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'asc'));
  onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
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

export function startDaysListener() {
  const q = query(collection(db, 'savedDays'), orderBy('dateKey', 'asc'));
  onSnapshot(q, (snap) => {
    setSavedDays(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    renderAnalytics();
    updateSaveDayBtn();
  });
}

// ── Write operations ───────────────────────────────────────────────────────────

export async function addOrderToFirestore(data) {
  return addDoc(collection(db, 'orders'), data);
}

export async function updateOrderInFirestore(fid, data) {
  return updateDoc(doc(db, 'orders', fid), data);
}

export async function deleteOrderFromFirestore(fid) {
  return deleteDoc(doc(db, 'orders', fid));
}

export async function saveDayToFirestore(key, snapshot) {
  return setDoc(doc(db, 'savedDays', key), snapshot);
}

export async function updateSavedDayInFirestore(fid, data) {
  return updateDoc(doc(db, 'savedDays', fid), data);
}

export async function deleteSavedDayFromFirestore(fid) {
  return deleteDoc(doc(db, 'savedDays', fid));
}
