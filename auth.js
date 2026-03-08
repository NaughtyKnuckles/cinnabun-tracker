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
import { app, db, getEmailByName } from './firebase.js';

export const auth = getAuth(app);

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

// Login by name — looks up email from nameIndex, then signs in
export async function loginByName(displayName, password) {
  const email = await getEmailByName(displayName);
  if (!email) throw { code: 'auth/user-not-found' };
  return signInWithEmailAndPassword(auth, email, password);
}

export const logout = () => signOut(auth);

export const register = async (displayName, email, pw, accountType) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(user, { displayName });

  // Save profile under users/{uid}/profile/info
  await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
    displayName,
    email,
    accountType,
    createdAt: Date.now(),
  });

  // Save name → email index for login-by-name lookup
  const nameLower = displayName.trim().toLowerCase();
  await setDoc(doc(db, 'nameIndex', nameLower), {
    email,
    displayName,
    nameLower,
  });

  return user;
};

export async function getUserAccountType(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
    return snap.exists() ? (snap.data().accountType || 'reseller') : 'reseller';
  } catch {
    return 'reseller';
  }
}
