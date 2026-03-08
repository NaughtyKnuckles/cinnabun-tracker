// ── auth.js ────────────────────────────────────────────────────────────────────
// Firebase Authentication: login, register, logout, session watching.

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { app } from './firebase.js';

export const auth = getAuth(app);

/** Calls onLogin(user) on sign-in, onLogout() on sign-out. */
export function watchAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, user => {
    if (user) onLogin(user);
    else      onLogout();
  });
}

export const login = (email, pw) =>
  signInWithEmailAndPassword(auth, email, pw);

export const logout = () => signOut(auth);

export const register = async (displayName, email, pw) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(user, { displayName });
  return user;
};
