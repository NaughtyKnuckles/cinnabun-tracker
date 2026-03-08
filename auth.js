// ── auth.js ────────────────────────────────────────────────────────────────────
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { app, db } from './firebase.js';  // reuse the same app + db instance

export const auth = getAuth(app);

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
  await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
    displayName,
    email,
    accountType,
    createdAt: Date.now(),
  });
  return user;
};

export async function getUserAccountType(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
    return snap.exists() ? (snap.data().accountType || 'reseller') : 'reseller';
  } catch {
    return 'reseller';  // default gracefully on any error
  }
}
