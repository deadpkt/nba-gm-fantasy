import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import OfficialGamePresentation from "../components/OfficialGamePresentation";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { db } from "../lib/firebase";
import { getPresentationFrame, isOfficialGameFinalVisible } from "../lib/officialGamePresentation";
import {
  finalizeOfficialGamePresentation,
  getOfficialParticipantSide,
  OFFICIAL_GAME_STATUS,
  startRegularSeasonRound,
} from "../lib/officialGames";
import { isRoundProgressionComplete, ROUND_STATUS } from "../lib/seasonProgress";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { getMissingLineupPositions, isLineupComplete } from "../utils/team";

function GamesPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague } = useLeague();
  const { roster, lineup, record } = useLeagueTeam();
  const rosterSize = normalizeRosterConfig(activeLeague).rosterSize;
  const [scheduleGames, setScheduleGames] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [gameActionError, setGameActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [openGameId, setOpenGameId] = useState(null);
  const [presentationNow, setPresentationNow] = useState(Date.now());
  const lineupReady = isLineupComplete(roster, lineup);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const progress = normalizeProgress(activeLeague, scheduleGames);
  const currentRoundGames = scheduleGames.filter(
    (game) => game.round === progress.currentRound,
  );
  const currentMatchup = currentRoundGames.find(
    (game) => getOfficialParticipantSide(game, user.uid),
  );
  const openGame = scheduleGames.find((game) => game.id === openGameId);
  const openGamePresenting =
    openGame?.timeline?.length &&
    !getPresentationFrame(openGame, presentationNow).finished;
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const canStartRound =
    isCommissioner &&
    !progress.regularSeasonComplete &&
    (progress.roundStatus === ROUND_STATUS.PENDING ||
      (progress.roundStatus === ROUND_STATUS.COMPLETED && isRoundProgressionComplete(currentRoundGames)));
  const nextRound = progress.roundStatus === ROUND_STATUS.COMPLETED
    ? progress.currentRound + 1
    : progress.currentRound;
  const rounds = useMemo(() => summarizeRounds(scheduleGames), [scheduleGames]);
  const presentationClockActive = scheduleGames.some(
    (game) => game.timeline?.length && !isOfficialGameFinalVisible(game, presentationNow),
  );

  async function run(actionName, action) {
    setGameActionError("");
    setBusyAction(actionName);
    try {
      await action();
    } catch (error) {
      setGameActionError(error.message || "The official game could not be updated.");
    } finally {
      setBusyAction("");
    }
  }

  function openOfficialGame(game) {
    if (!getOfficialParticipantSide(game, user.uid)) {
      setGameActionError("Only scheduled participants can open this official game.");
      return;
    }
    setOpenGameId(game.id);
  }

  useEffect(() => {
    if (!presentationClockActive) return undefined;
    const interval = window.setInterval(() => setPresentationNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [presentationClockActive]);

  useEffect(() => {
    if (!activeLeagueId || !activeLeague?.season) {
      setScheduleGames([]);
      setScheduleLoading(false);
      return undefined;
    }
    setScheduleGames([]);
    setScheduleError("");
    setScheduleLoading(true);
    return onSnapshot(
      query(collection(db, "leagues", activeLeagueId, "games"), where("season", "==", activeLeague.season)),
      (snapshot) => {
        setScheduleGames(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.scheduledOrder ?? 0) - (b.scheduledOrder ?? 0)));
        setScheduleLoading(false);
      },
      (error) => {
        console.error("Could not load official league schedule:", error);
        setScheduleError("The official schedule is currently unavailable.");
        setScheduleLoading(false);
      },
    );
  }, [activeLeague?.season, activeLeagueId]);

  return (
    <PageLayout>
      <section className="page-hero games-hero">
        <p className="section-label">OFFICIAL REGULAR SEASON</p>
        <h1>Season {activeLeague?.season} <span>Round {progress.currentRound}.</span></h1>
        <p>{progress.regularSeasonComplete ? "Regular season complete. Playoff progression is not implemented yet." : `Round ${progress.currentRound} of ${progress.totalRounds}.`}</p>
      </section>
      <section className="official-schedule">
        {gameActionError && <p className="official-game-error" role="alert">{gameActionError}</p>}
        {isCommissioner && (
          <div className="round-control-panel broadcast-control">
            <div><span>COMMISSIONER CONTROL</span><b>{progress.regularSeasonComplete ? "REGULAR SEASON COMPLETE" : progress.roundStatus === ROUND_STATUS.ACTIVE ? `ROUND ${progress.currentRound} IN PROGRESS — WAITING FOR LIVE GAMES TO FINISH` : progress.roundStatus === ROUND_STATUS.COMPLETED && !isRoundProgressionComplete(currentRoundGames) ? `ROUND ${progress.currentRound} — WAITING FOR LIVE GAMES TO FINISH` : progress.roundStatus === ROUND_STATUS.COMPLETED ? `ROUND ${progress.currentRound} COMPLETE` : `ROUND ${progress.currentRound} AVAILABLE`}</b></div>
            {canStartRound && nextRound <= progress.totalRounds && (
              <button className="button-primary" type="button" disabled={Boolean(busyAction)} onClick={() => run("round", () => startRegularSeasonRound({ leagueId: activeLeagueId }))}>
                {busyAction === "round" ? "Starting..." : progress.roundStatus === ROUND_STATUS.COMPLETED ? `Start Next Round (${nextRound})` : `Start Round ${nextRound}`}
              </button>
            )}
          </div>
        )}
        {openGame && (
          <div className="official-game-session">
            <span>OFFICIAL GAME / ROUND {openGame.round}</span>
            <h3>{openGame.awayTeamName} at {openGame.homeTeamName}</h3>
            <p>Status: {openGamePresenting ? "LIVE PRESENTATION" : openGame.status.replaceAll("_", " ").toUpperCase()}</p>
            <OfficialGamePresentation game={openGame} onPresentationComplete={() => finalizeOfficialGamePresentation({ leagueId: activeLeagueId, gameId: openGame.id })} renderFinal={() => <OfficialBoxScore game={openGame} />} />
          </div>
        )}
        {scheduleLoading ? <p>Loading official schedule...</p> : scheduleError ? <p role="alert">{scheduleError}</p> : (
          <>
            <section className="current-matchup broadcast-matchup">
              <span>CURRENT ROUND / YOUR MATCHUP</span>
              {currentMatchup ? (
                <>
                  <div className="broadcast-matchup__teams">
                    <span><small>AWAY TEAM</small><b>{currentMatchup.awayTeamName}</b></span>
                    <i>VS</i>
                    <span><small>HOME TEAM</small><b>{currentMatchup.homeTeamName}</b></span>
                  </div>
                  <small>Round {currentMatchup.round} <i className={`game-status-chip game-status-chip--${gameStatusLabel(currentMatchup, presentationNow).toLowerCase()}`}>{gameStatusLabel(currentMatchup, presentationNow)}</i></small>
                  {[OFFICIAL_GAME_STATUS.IN_PROGRESS, OFFICIAL_GAME_STATUS.COMPLETED].includes(currentMatchup.status) && (
                    <button className={gameStatusLabel(currentMatchup, presentationNow) === "LIVE" ? "button-primary" : "button-secondary"} type="button" disabled={busyAction === `game-${currentMatchup.id}`} onClick={() => openOfficialGame(currentMatchup)}>
                      {busyAction === `game-${currentMatchup.id}` ? "Preparing..." : gameStatusLabel(currentMatchup, presentationNow) === "LIVE" ? "Watch Live" : "View Result"}
                    </button>
                  )}
                </>
              ) : <p>No matchup is assigned to your franchise in this round.</p>}
            </section>
            <section className="compact-schedule">
              <h3>League schedule</h3>
              {rounds.map((round) => (
                <details open={round.round === progress.currentRound} key={round.round}>
                  <summary><b>Round {round.round}</b><span>{round.label}</span></summary>
                  {round.games.map((game) => (
                    <div key={game.id}><span>#{game.gameNumber}</span><b>{game.awayTeamName} at {game.homeTeamName}</b><small>{isOfficialGameFinalVisible(game, presentationNow) ? `${game.result?.awayScore}–${game.result?.homeScore} FINAL` : game.timeline?.length ? "LIVE" : game.status.replaceAll("_", " ").toUpperCase()}</small></div>
                  ))}
                </details>
              ))}
            </section>
          </>
        )}
      </section>
      <section className="game-status"><div><span>SEASON RECORD</span><b>{record.wins}-{record.losses}</b></div><div><span>ROSTER</span><b>{roster.length}/{rosterSize} PLAYERS</b></div><div><span>LINEUP STATUS</span><b>{lineupReady ? "READY FOR TIP-OFF" : `MISSING: ${missingPositions.join(", ")}`}</b></div></section>
    </PageLayout>
  );
}

function normalizeProgress(league, games) {
  if (league?.seasonProgress) return league.seasonProgress;
  const totalRounds = league?.schedule?.totalRounds || Math.max(1, ...games.map((game) => game.round));
  const firstIncomplete = Array.from({ length: totalRounds }, (_, index) => index + 1).find(
    (round) => games.some((game) => game.round === round && game.status !== OFFICIAL_GAME_STATUS.COMPLETED),
  );
  const currentRound = firstIncomplete || totalRounds;
  const currentGames = games.filter((game) => game.round === currentRound);
  return {
    currentRound,
    totalRounds,
    roundStatus: currentGames.some((game) => game.status === OFFICIAL_GAME_STATUS.IN_PROGRESS) ? ROUND_STATUS.ACTIVE : currentGames.length && currentGames.every((game) => game.status === OFFICIAL_GAME_STATUS.COMPLETED) ? ROUND_STATUS.COMPLETED : ROUND_STATUS.PENDING,
    regularSeasonComplete: games.length > 0 && games.every((game) => game.status === OFFICIAL_GAME_STATUS.COMPLETED),
  };
}

function summarizeRounds(games) {
  const grouped = new Map();
  games.forEach((game) => grouped.set(game.round, [...(grouped.get(game.round) || []), game]));
  return [...grouped].map(([round, roundGames]) => ({
    round,
    games: roundGames,
    label: roundGames.every((game) => game.status === OFFICIAL_GAME_STATUS.COMPLETED) ? "Complete" : roundGames.some((game) => game.status === OFFICIAL_GAME_STATUS.IN_PROGRESS) ? "Live" : "Upcoming",
  }));
}

function gameStatusLabel(game, now) {
  if (game.timeline?.length && !isOfficialGameFinalVisible(game, now)) return "LIVE";
  return isOfficialGameFinalVisible(game, now) ? "FINAL" : game.status.replaceAll("_", " ").toUpperCase();
}

function OfficialBoxScore({ game }) {
  const winnerName = game.result?.winnerUid === game.homeUid ? game.homeTeamName : game.awayTeamName;
  return <div className="official-box-score"><div className="official-box-score__final"><b>FINAL</b><strong>{game.awayTeamName} {game.result?.awayScore} - {game.result?.homeScore} {game.homeTeamName}</strong><span>Winner: {winnerName}</span></div>{[game.boxScore?.away, game.boxScore?.home].filter(Boolean).map((team) => <section key={team.uid}><h4>{team.teamName}</h4><small>Strategy: {team.strategy}</small>{team.players.map((player) => <p key={player.playerId}><b>{player.name}</b><span>{player.stats.points} PTS · {player.stats.rebounds} REB · {player.stats.assists} AST · {player.stats.steals} STL · {player.stats.blocks} BLK</span></p>)}</section>)}</div>;
}

export default GamesPage;
