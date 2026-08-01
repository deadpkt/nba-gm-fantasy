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
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
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

  async function saveUserProfile(currentUser) {
    const privateRef = doc(db, "users", currentUser.uid);
    const publicRef = doc(db, "publicProfiles", currentUser.uid);
    const publicSnapshot = await getDoc(publicRef);
    const now = serverTimestamp();
    const batch = writeBatch(db);
    batch.set(privateRef, {
        displayName: currentUser.displayName || "",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        updatedAt: now,
      }, { merge: true });
    batch.set(publicRef, publicSnapshot.exists() ? {
      displayName: currentUser.displayName || "",
      photoURL: currentUser.photoURL || "",
      bannerURL: publicSnapshot.data().bannerURL || "",
      updatedAt: now,
    } : {
      uid: currentUser.uid,
      displayName: currentUser.displayName || "Full Court Player",
      photoURL: currentUser.photoURL || "",
      bannerURL: "",
      joinedAt: now,
      followersCount: 0,
      followingCount: 0,
      updatedAt: now,
    }, { merge: true });
    await batch.commit();
  }

  async function signUp({ displayName, email, password }) {
    await configureLocalPersistence();
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    await updateProfile(credential.user, { displayName: displayName.trim() });
    await saveUserProfile(credential.user);
  }

  async function login({ email, password }) {
    await configureLocalPersistence();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    await saveUserProfile(credential.user);
  }
  async function signInWithGoogle() {
    await configureLocalPersistence();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    await saveUserProfile(credential.user);
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
