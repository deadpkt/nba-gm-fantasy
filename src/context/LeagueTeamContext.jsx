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
import { reportClientError } from "../lib/clientErrors";
import {
  addLeagueTeamPlayer,
  assignLeagueTeamPlayer,
  normalizeLeagueTeam,
  recordLeagueTeamResult,
  removeLeagueTeamPlayer,
  setLeagueTeamSeasonConfirmation,
  setLeagueTeamOffseasonConfirmation,
  setLeagueTeamStrategy,
} from "../lib/leagueTeams";

export const LeagueTeamContext = createContext(null);

export function LeagueTeamProvider({ children }) {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeagueId, activeLeague } = useLeague();
  const [leagueTeam, setLeagueTeam] = useState(null);
  const [leagueTeamLoading, setLeagueTeamLoading] = useState(true);
  const [leagueTeamError, setLeagueTeamError] = useState(null);
  const seasonConfirmed = Boolean(
    user && activeLeague?.seasonReadyMemberIds?.includes(user.uid),
  );
  const offseasonConfirmed = Boolean(user && activeLeague?.offseason?.nextSeason === activeLeague?.season + 1 && activeLeague?.offseason?.readyMemberIds?.includes(user.uid));

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
        reportClientError("Franchise", error);
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
      seasonConfirmed,
      offseasonConfirmed,
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
      confirmSeasonLineup: async (confirmed) => {
        const { leagueId, userId } = requireActiveTeam();
        await setLeagueTeamSeasonConfirmation(
          leagueId,
          userId,
          confirmed,
        );
      },
      confirmOffseasonLineup: async (confirmed) => {
        const { leagueId, userId } = requireActiveTeam();
        await setLeagueTeamOffseasonConfirmation(leagueId, userId, confirmed);
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
      seasonConfirmed,
      offseasonConfirmed,
    ],
  );

  return (
    <LeagueTeamContext.Provider value={value}>
      {children}
    </LeagueTeamContext.Provider>
  );
}
