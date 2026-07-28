import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import {
  addLeagueTeamPlayer,
  assignLeagueTeamPlayer,
  normalizeLeagueTeam,
  recordLeagueTeamResult,
  removeLeagueTeamPlayer,
  setLeagueTeamStrategy,
} from "../lib/leagueTeams";

export const LeagueTeamContext = createContext(null);

export function LeagueTeamProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeagueId } = useLeague();
  const [leagueTeam, setLeagueTeam] = useState(null);
  const [leagueTeamLoading, setLeagueTeamLoading] = useState(true);
  const [leagueTeamError, setLeagueTeamError] = useState(null);

  useEffect(() => {
    if (!user || !firebaseEnabled || !activeLeagueId) {
      setLeagueTeam(null);
      setLeagueTeamError(null);
      setLeagueTeamLoading(false);
      return undefined;
    }

    setLeagueTeam(null);
    setLeagueTeamError(null);
    setLeagueTeamLoading(true);

    console.debug("[LeagueTeamContext] Starting team listener", {
      authUid: user.uid,
      activeLeagueId,
      teamPath: `leagues/${activeLeagueId}/teams/${user.uid}`,
    });

    return onSnapshot(
      doc(db, "leagues", activeLeagueId, "teams", user.uid),
      (snapshot) => {
        setLeagueTeam(
          snapshot.exists()
            ? normalizeLeagueTeam(snapshot.id, snapshot.data())
            : null,
        );
        setLeagueTeamLoading(false);
      },
      (error) => {
        console.error("Could not load league franchise:", error);
        setLeagueTeam(null);
        setLeagueTeamError(error);
        setLeagueTeamLoading(false);
      },
    );
  }, [activeLeagueId, firebaseEnabled, user]);

  const requireActiveTeam = useCallback(() => {
    if (!user || !activeLeagueId) {
      throw new Error("Select a league before managing a franchise.");
    }
    return { leagueId: activeLeagueId, userId: user.uid };
  }, [activeLeagueId, user]);

  const value = useMemo(
    () => ({
      activeLeagueId,
      leagueTeam,
      roster: leagueTeam?.roster || [],
      lineup: leagueTeam?.lineup || {},
      strategy: leagueTeam?.strategy || null,
      record: leagueTeam?.record || { wins: 0, losses: 0 },
      leagueTeamLoading,
      leagueTeamError,
      addPlayer: async (player) => {
        const { leagueId, userId } = requireActiveTeam();
        await addLeagueTeamPlayer(leagueId, userId, player);
      },
      removePlayer: async (playerId) => {
        const { leagueId, userId } = requireActiveTeam();
        await removeLeagueTeamPlayer(leagueId, userId, playerId);
      },
      assignPlayer: async (position, playerId) => {
        const { leagueId, userId } = requireActiveTeam();
        await assignLeagueTeamPlayer(leagueId, userId, position, playerId);
      },
      setStrategy: async (nextStrategy) => {
        const { leagueId, userId } = requireActiveTeam();
        await setLeagueTeamStrategy(leagueId, userId, nextStrategy);
      },
      recordResult: async (won) => {
        const { leagueId, userId } = requireActiveTeam();
        await recordLeagueTeamResult(leagueId, userId, won);
      },
    }),
    [
      activeLeagueId,
      leagueTeam,
      leagueTeamError,
      leagueTeamLoading,
      requireActiveTeam,
    ],
  );

  return (
    <LeagueTeamContext.Provider value={value}>
      {children}
    </LeagueTeamContext.Provider>
  );
}
