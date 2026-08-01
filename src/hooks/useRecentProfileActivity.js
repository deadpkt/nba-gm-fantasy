import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function useRecentProfileActivity(leagueId, uid, enabled = true) {
  const [state, setState] = useState({ activities: [], loading: false, error: "" });

  useEffect(() => {
    let active = true;
    if (!enabled || !leagueId || !uid || !db) {
      setState({ activities: [], loading: false, error: "" });
      return () => { active = false; };
    }
    setState({ activities: [], loading: true, error: "" });
    const activityQuery = query(
      collection(db, "leagues", leagueId, "activity"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    getDocs(activityQuery).then((snapshot) => {
      if (!active) return;
      const activities = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.actorUid === uid || item.targetUid === uid || item.metadata?.uid === uid)
        .slice(0, 5);
      setState({ activities, loading: false, error: "" });
    }).catch(() => {
      if (active) setState({ activities: [], loading: false, error: "Activity is temporarily unavailable." });
    });
    return () => { active = false; };
  }, [enabled, leagueId, uid]);

  return state;
}
