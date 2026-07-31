import { createContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import useAuth from "../hooks/useAuth";
import useTeam from "../hooks/useTeam";
import { db } from "../lib/firebase";
import { reportClientError } from "../lib/clientErrors";
import {
  cancelLeague,
  createLeague,
  joinLeague,
  leaveLeague,
  selectLeague,
  setLeagueMemberReady,
  startLeagueDraft,
  startLeagueSeason,
} from "../lib/leagues";

export const LeagueContext = createContext(null);

export function LeagueProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeagueId, profileLoading } = useTeam();
  const [activeLeague, setActiveLeague] = useState(null);
  const [resolvedLeagueId, setResolvedLeagueId] = useState(null);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leagueError, setLeagueError] = useState(null);
  const leagueLoading =
    profileLoading ||
    Boolean(activeLeagueId && resolvedLeagueId !== activeLeagueId);
  const resolvedActiveLeague =
    activeLeagueId && resolvedLeagueId === activeLeagueId
      ? activeLeague
      : null;

  useEffect(() => {
    if (!user || !firebaseEnabled || profileLoading || !activeLeagueId) {
      setActiveLeague(null);
      setResolvedLeagueId(null);
      setMembers([]);
      setTeams([]);
      setLeagueError(null);
      return undefined;
    }

    setActiveLeague(null);
    setMembers([]);
    setTeams([]);
    setLeagueError(null);

    const unsubscribeLeague = onSnapshot(
      doc(db, "leagues", activeLeagueId),
      (snapshot) => {
        setActiveLeague(
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        );
        setResolvedLeagueId(activeLeagueId);
      },
      (error) => {
        reportClientError("League", error);
        setActiveLeague(null);
        setResolvedLeagueId(activeLeagueId);
        setLeagueError(error);
      },
    );
    const unsubscribeMembers = onSnapshot(
      query(
        collection(db, "leagues", activeLeagueId, "members"),
        orderBy("joinedAt"),
      ),
      (snapshot) => {
        setMembers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
      },
      (error) => {
        reportClientError("League members", error);
        setLeagueError(error);
      },
    );
    const unsubscribeTeams = onSnapshot(
      collection(db, "leagues", activeLeagueId, "teams"),
      (snapshot) => {
        setTeams(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
      },
      (error) => {
        reportClientError("League teams", error);
        setLeagueError(error);
      },
    );
    return () => {
      unsubscribeLeague();
      unsubscribeMembers();
      unsubscribeTeams();
    };
  }, [activeLeagueId, firebaseEnabled, profileLoading, user]);

  const value = useMemo(
    () => ({
      activeLeagueId,
      activeLeague: resolvedActiveLeague,
      members,
      teams,
      leagueLoading,
      leagueError,
      createLeague: async (details) => createLeague({ user, ...details }),
      joinLeague: async (inviteCode) => joinLeague({ user, inviteCode }),
      selectLeague: async (leagueId) => selectLeague(user.uid, leagueId),
      setReady: async (ready) =>
        setLeagueMemberReady({
          leagueId: activeLeagueId,
          userId: user.uid,
          ready,
        }),
      startDraft: async () =>
        startLeagueDraft({ leagueId: activeLeagueId, userId: user.uid }),
      startSeason: async () =>
        startLeagueSeason({ leagueId: activeLeagueId, userId: user.uid }),
      leaveLeague: async () =>
        leaveLeague({ leagueId: activeLeagueId, userId: user.uid }),
      cancelLeague: async () =>
        cancelLeague({
          leagueId: activeLeagueId,
          userId: user.uid,
        }),
    }),
    [
      activeLeagueId,
      resolvedActiveLeague,
      members,
      teams,
      leagueLoading,
      leagueError,
      user,
    ],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
}
