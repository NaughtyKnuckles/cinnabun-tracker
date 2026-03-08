// ── auth.js ────────────────────────────────────────────────────────────────────
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { app } from './firebase.js';

export const auth = getAuth(app);
const db2 = getFirestore(app); // same instance, just for profile reads

/** Calls onLogin(user, accountType) on sign-in, onLogout() on sign-out. */
export function watchAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async user => {
    if (user) {
      const accountType = await getUserAccountType(user.uid);
      onLogin(user, accountType);
    } else {
      onLogout();
    }
  });
}

export const login  = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logout = ()          => signOut(auth);

export const register = async (displayName, email, pw, accountType) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(user, { displayName });
  // Save profile (accountType) to Firestore under users/{uid}/profile/info
  await setDoc(doc(db2, 'users', user.uid, 'profile', 'info'), {
    displayName,
    email,
    accountType,  // 'reseller' | 'seller'
    createdAt: Date.now(),
  });
  return user;
};

export async function getUserAccountType(uid) {
  try {
    const snap = await getDoc(doc(db2, 'users', uid, 'profile', 'info'));
    return snap.exists() ? (snap.data().accountType || 'reseller') : 'reseller';
  } catch {
    return 'reseller';
  }
}
