import { useEffect, useState } from "react";
import { ensurePublicProfile, normalizePublicProfile, subscribePublicProfile } from "../lib/publicProfiles";

export default function usePublicProfile(uid) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); setError(null); return undefined; }
    let active = true;
    let projectionRequested = false;
    setLoading(true); setError(null);
    const unsubscribe = subscribePublicProfile(uid, (value) => {
      if (!active) return;
      if (value) { setProfile(normalizePublicProfile(value)); setLoading(false); return; }
      if (projectionRequested) return;
      projectionRequested = true;
      void ensurePublicProfile(uid).catch((nextError) => {
        if (active) { setError(nextError); setLoading(false); }
      });
    }, (nextError) => { if (active) { setError(nextError); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [uid]);

  return { profile, loading, error };
}
