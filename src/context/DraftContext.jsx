import { createContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import {
  draftPicksRef,
  draftStateRef,
  initializeLeagueDraft,
  makeDraftPick,
} from "../lib/draft";
import { db } from "../lib/firebase";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";

export const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeagueId, activeLeague } = useLeague();
  const [draft, setDraft] = useState(null);
  const [picks, setPicks] = useState([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState(new Set());

  useEffect(() => {
    if (!firebaseEnabled || !user || !activeLeagueId) {
      setDraft(null);
      setPicks([]);
      setDraftLoading(false);
      setDraftError(null);
      setOwnedPlayerIds(new Set());
      return undefined;
    }

    setDraftLoading(true);
    setDraftError(null);
    let stateLoaded = false;
    let picksLoaded = false;
    let ownershipLoaded = false;
    const finishLoading = () => {
      if (stateLoaded && picksLoaded && ownershipLoaded) setDraftLoading(false);
    };
    const unsubscribeState = onSnapshot(
      draftStateRef(activeLeagueId),
      (snapshot) => {
        setDraft(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        if (
          !snapshot.exists() &&
          activeLeague?.status === LEAGUE_STATUS.DRAFTING &&
          activeLeague.commissionerUid === user.uid
        ) {
          void initializeLeagueDraft({
            leagueId: activeLeagueId,
            userId: user.uid,
          }).catch(setDraftError);
        }
        stateLoaded = true;
        finishLoading();
      },
      (error) => {
        setDraftError(error);
        setDraftLoading(false);
      },
    );
    const unsubscribePicks = onSnapshot(
      query(draftPicksRef(activeLeagueId), orderBy("overallPick")),
      (snapshot) => {
        setPicks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        picksLoaded = true;
        finishLoading();
      },
      (error) => {
        setDraftError(error);
        setDraftLoading(false);
      },
    );
    const unsubscribeOwnership = onSnapshot(
      collection(db, "leagues", activeLeagueId, "playerOwnership"),
      (snapshot) => {
        setOwnedPlayerIds(new Set(snapshot.docs.map((item) => item.id)));
        ownershipLoaded = true;
        finishLoading();
      },
      (error) => {
        setDraftError(error);
        setDraftLoading(false);
      },
    );

    return () => {
      unsubscribeState();
      unsubscribePicks();
      unsubscribeOwnership();
    };
  }, [activeLeague, activeLeagueId, firebaseEnabled, user]);

  const value = useMemo(
    () => ({
      draft,
      picks,
      draftedPlayerIds: new Set([
        ...ownedPlayerIds,
        ...picks.map((pick) => String(pick.playerId)),
      ]),
      draftLoading,
      draftError,
      makePick: async (playerId) =>
        makeDraftPick({ leagueId: activeLeagueId, userId: user.uid, playerId }),
    }),
    [activeLeagueId, draft, draftError, draftLoading, ownedPlayerIds, picks, user],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
