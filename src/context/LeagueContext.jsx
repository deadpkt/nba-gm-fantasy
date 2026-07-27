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
import { createLeague, joinLeague, selectLeague } from "../lib/leagues";

export const LeagueContext = createContext(null);

export function LeagueProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeagueId, profileLoading } = useTeam();
  const [activeLeague, setActiveLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [leagueLoading, setLeagueLoading] = useState(true);
  const [leagueError, setLeagueError] = useState(null);

  useEffect(() => {
    if (!user || !firebaseEnabled || profileLoading || !activeLeagueId) {
      setActiveLeague(null);
      setMembers([]);
      setLeagueError(null);
      setLeagueLoading(profileLoading);
      return undefined;
    }

    setActiveLeague(null);
    setMembers([]);
    setLeagueLoading(true);
    setLeagueError(null);
    let leagueLoaded = false;
    let membersLoaded = false;
    const finishLoading = () => {
      if (leagueLoaded && membersLoaded) setLeagueLoading(false);
    };

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
    return () => {
      unsubscribeLeague();
      unsubscribeMembers();
    };
  }, [activeLeagueId, firebaseEnabled, profileLoading, user]);

  const value = useMemo(
    () => ({
      activeLeagueId,
      activeLeague,
      members,
      leagueLoading,
      leagueError,
      createLeague: async (details) => createLeague({ user, ...details }),
      joinLeague: async (inviteCode) => joinLeague({ user, inviteCode }),
      selectLeague: async (leagueId) => selectLeague(user.uid, leagueId),
    }),
    [activeLeagueId, activeLeague, members, leagueLoading, leagueError, user],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
}
