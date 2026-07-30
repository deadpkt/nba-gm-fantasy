import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import useLeague from "./useLeague";
import { db } from "../lib/firebase";

export default function useFreeAgencyOwnership({ enabled = true } = {}) {
  const { activeLeagueId } = useLeague();
  const [ownedPlayerIds, setOwnedPlayerIds] = useState(new Set());
  const [ownershipLoading, setOwnershipLoading] = useState(true);
  const [ownershipError, setOwnershipError] = useState("");

  useEffect(() => {
    if (!enabled || !activeLeagueId) {
      setOwnedPlayerIds(new Set());
      setOwnershipLoading(false);
      return undefined;
    }
    setOwnershipLoading(true);
    setOwnershipError("");
    return onSnapshot(collection(db, "leagues", activeLeagueId, "playerOwnership"), (snapshot) => {
      setOwnedPlayerIds(new Set(snapshot.docs.map((item) => String(item.id))));
      setOwnershipLoading(false);
    }, () => {
      setOwnedPlayerIds(new Set());
      setOwnershipError("League player availability is currently unavailable.");
      setOwnershipLoading(false);
    });
  }, [activeLeagueId, enabled]);

  return { ownedPlayerIds, ownershipLoading, ownershipError };
}
