import { createContext, useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "../lib/firebase";

export const AuthContext = createContext(null);

let localPersistencePromise;

function configureLocalPersistence() {
  if (!localPersistencePromise)
    localPersistencePromise = setPersistence(auth, browserLocalPersistence);
  return localPersistencePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!firebaseEnabled) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthError(null);
        setLoading(false);
      },
      (error) => {
        setUser(null);
        setAuthError(error);
        setLoading(false);
      },
    );
    void configureLocalPersistence().catch((error) => {
      if (active) setAuthError(error);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  function saveUserProfile(currentUser) {
    return setDoc(
      doc(db, "users", currentUser.uid),
      {
        displayName: currentUser.displayName || "",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async function signUp({ displayName, email, password }) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await updateProfile(credential.user, { displayName });
    void saveUserProfile(credential.user).catch((error) =>
      console.error("Could not save new user profile:", error),
    );
  }

  async function login({ email, password }) {
    await signInWithEmailAndPassword(auth, email, password);
  }
  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    void saveUserProfile(credential.user).catch((error) =>
      console.error("Could not sync Google profile:", error),
    );
  }
  async function logout() {
    await signOut(auth);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signUp,
      login,
      signInWithGoogle,
      logout,
      firebaseEnabled,
    }),
    [user, loading, authError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
