import { createContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import useAuth from "../hooks/useAuth";
import { db } from "../lib/firebase";

export const TeamContext = createContext(null);

const profileFrom = (user, profile = {}) => ({
  displayName: profile.displayName ?? user?.displayName ?? "",
  email: profile.email ?? user?.email ?? "",
  photoURL: profile.photoURL ?? user?.photoURL ?? "",
});

export function TeamProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const [profile, setProfile] = useState(() => profileFrom(null));
  const [activeLeagueId, setActiveLeagueId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    if (!user || !firebaseEnabled) {
      setProfile(profileFrom(user));
      setActiveLeagueId(null);
      setProfileError(null);
      setProfileLoading(false);
      return undefined;
    }

    setProfileLoading(true);
    setProfileError(null);
    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setProfile(profileFrom(user, data));
        setActiveLeagueId(data.activeLeagueId || null);
        setProfileLoading(false);
      },
      (error) => {
        console.error("Could not load user profile:", error);
        setProfile(profileFrom(user));
        setActiveLeagueId(null);
        setProfileError(error);
        setProfileLoading(false);
      },
    );
  }, [user, firebaseEnabled]);

  const value = useMemo(
    () => ({
      profile,
      activeLeagueId,
      profileLoading,
      profileError,
    }),
    [profile, activeLeagueId, profileLoading, profileError],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
