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
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leagueLoading, setLeagueLoading] = useState(true);
  const [leagueError, setLeagueError] = useState(null);

  useEffect(() => {
    if (!user || !firebaseEnabled || profileLoading || !activeLeagueId) {
      setActiveLeague(null);
      setMembers([]);
      setTeams([]);
      setLeagueError(null);
      setLeagueLoading(profileLoading);
      return undefined;
    }

    setActiveLeague(null);
    setMembers([]);
    setTeams([]);
    setLeagueLoading(true);
    setLeagueError(null);
    let leagueLoaded = false;
    let membersLoaded = false;
    let teamsLoaded = false;
    const finishLoading = () => {
      if (leagueLoaded && membersLoaded && teamsLoaded) setLeagueLoading(false);
    };

    console.debug("[LeagueContext] Starting league listeners", {
      authUid: user.uid,
      activeLeagueId,
      leaguePath: `leagues/${activeLeagueId}`,
      membersPath: `leagues/${activeLeagueId}/members`,
    });

    const unsubscribeLeague = onSnapshot(
      doc(db, "leagues", activeLeagueId),
      (snapshot) => {
        setActiveLeague(
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        );
        leagueLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Could not load active league:", error);
        setLeagueError(error);
        setLeagueLoading(false);
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
        membersLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Could not load league members:", error);
        setLeagueError(error);
        setLeagueLoading(false);
      },
    );
    const unsubscribeTeams = onSnapshot(
      collection(db, "leagues", activeLeagueId, "teams"),
      (snapshot) => {
        setTeams(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        );
        teamsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Could not load league teams:", error);
        setLeagueError(error);
        setLeagueLoading(false);
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
      activeLeague,
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
    [activeLeagueId, activeLeague, members, teams, leagueLoading, leagueError, user],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
}
