import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function useLeagueActivity(leagueId, enabled = true) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && leagueId));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled || !leagueId || !db) { setActivities([]); setLoading(false); setError(""); return undefined; }
    setLoading(true); setError("");
    const activityQuery = query(collection(db, "leagues", leagueId, "activity"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(activityQuery, (snapshot) => {
      setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, () => { setError("League activity is temporarily unavailable."); setLoading(false); });
  }, [enabled, leagueId]);
  return { activities, loading, error };
}
