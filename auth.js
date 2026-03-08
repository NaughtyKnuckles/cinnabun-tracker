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

// Firebase requires an email — we generate a hidden one from the username
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${clean}@japastry.app`;
}

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

// Login by username — converts to fake email and signs in
export async function loginByName(username, password) {
  // First try the direct username→email conversion
  const email = usernameToEmail(username);
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    // Fallback: look up via nameIndex (handles edge cases / old accounts)
    const indexedEmail = await getEmailByName(username);
    if (indexedEmail && indexedEmail !== email) {
      return await signInWithEmailAndPassword(auth, indexedEmail, password);
    }
    throw e;
  }
}

export const logout = () => signOut(auth);

export const register = async (username, password, accountType) => {
  const email = usernameToEmail(username);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: username });

  // Save profile
  await setDoc(doc(db, 'users', user.uid, 'profile', 'info'), {
    displayName: username,
    email,
    accountType,
    createdAt: Date.now(),
  });

  // Save name index for fallback lookup
  await setDoc(doc(db, 'nameIndex', username.trim().toLowerCase()), {
    email,
    displayName: username,
    nameLower: username.trim().toLowerCase(),
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
