import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import useAuth from "./useAuth";
import useLeague from "./useLeague";
import useLeagueTeam from "./useLeagueTeam";
import useLeagueContracts from "./useLeagueContracts";
import { db } from "../lib/firebase";
import { getLeagueNextAction } from "../lib/leagueGuidance";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { getOffseasonTeamPreparationState } from "../lib/offseasonPreparation";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import { isOfficialGameFinalVisible } from "../lib/officialGamePresentation";

export default function useLeagueGuidance() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, members, teams } = useLeague();
  const { leagueTeam, seasonConfirmed, offseasonConfirmed } = useLeagueTeam();
  const { contracts } = useLeagueContracts({ enabled: activeLeague?.status === LEAGUE_STATUS.OFFSEASON });
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!activeLeagueId || ![LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS].includes(activeLeague?.status)) {
      setGames([]);
      return undefined;
    }
    return onSnapshot(query(collection(db, "leagues", activeLeagueId, "games"), where("season", "==", activeLeague.season)), (snapshot) => {
      setGames(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, () => setGames([]));
  }, [activeLeague?.season, activeLeague?.status, activeLeagueId]);

  return useMemo(() => {
    const member = members.find((item) => item.uid === user?.uid);
    const progress = activeLeague?.seasonProgress || {};
    const regularGames = games.filter((game) => !game.stage || game.stage === "regular_season");
    const currentRound = progress.currentRound || regularGames.find((game) => game.status !== "completed")?.round || 1;
    const matchup = regularGames.find((game) => game.round === currentRound && [game.homeUid, game.awayUid].includes(user?.uid));
    const currentMatchup = matchup ? {
      ...matchup,
      presentationLive: Boolean(matchup.timeline?.length && !isOfficialGameFinalVisible(matchup, Date.now())),
    } : null;
    const seasonReadyTeams = teams.filter((team) => activeLeague?.seasonReadyMemberIds?.includes(team.ownerUid) && isLeagueTeamSeasonReady(team, activeLeague));
    const offseasonReadyTeams = teams.filter((team) => getOffseasonTeamPreparationState({ league: activeLeague, team, userId: team.ownerUid, contracts }).ready);
    const offseason = activeLeague?.status === LEAGUE_STATUS.OFFSEASON;
    const readyTeams = offseason ? offseasonReadyTeams : seasonReadyTeams;
    const teamReady = offseason
      ? Boolean(offseasonConfirmed && getOffseasonTeamPreparationState({ league: activeLeague, team: leagueTeam, userId: user?.uid, contracts }).ready)
      : Boolean(seasonConfirmed && leagueTeam && isLeagueTeamSeasonReady(leagueTeam, activeLeague));
    const totalMembers = members.length || activeLeague?.memberIds?.length || 0;

    return getLeagueNextAction({
      league: activeLeague,
      userId: user?.uid,
      memberReady: Boolean(member?.ready),
      teamReady,
      readyCount: [LEAGUE_STATUS.SEASON_READY, LEAGUE_STATUS.OFFSEASON].includes(activeLeague?.status) ? readyTeams.length : members.filter((item) => item.ready).length,
      totalMembers,
      allTeamsReady: totalMembers > 0 && readyTeams.length === totalMembers,
      currentMatchup,
      currentRound,
      totalRounds: progress.totalRounds || activeLeague?.schedule?.totalRounds || 0,
      roundStatus: progress.roundStatus || "pending",
      regularSeasonComplete: progress.regularSeasonComplete === true,
      playoffGames: games.filter((game) => ["semifinal", "final"].includes(game.stage)),
    });
  }, [activeLeague, contracts, games, leagueTeam, members, offseasonConfirmed, seasonConfirmed, teams, user?.uid]);
}
