import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OfficialGamePresentation from "../components/OfficialGamePresentation";
import PageLayout from "../components/PageLayout";
import {
  FeaturedMatchup,
  GamesHeader,
  RecentLeaders,
  RoundScoreboard,
  SeasonTimeline,
  StakesPanel,
} from "../components/games/GameNightHub";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { getUserFriendlyError, reportClientError } from "../lib/clientErrors";
import {
  buildSeasonTimeline,
  deriveMatchupStoryline,
  GAME_HUB_STATUS,
  getHubGameStatus,
  getRecentGameLeaders,
  getVisibleGameScore,
  selectFeaturedGame,
  visibleCompletedGames,
} from "../lib/gamesHub";
import { isOfficialGameFinalVisible } from "../lib/officialGamePresentation";
import {
  finalizeOfficialGamePresentation,
  getOfficialParticipantSide,
  startRegularSeasonRound,
} from "../lib/officialGames";
import { isRoundProgressionComplete, ROUND_STATUS } from "../lib/seasonProgress";
import { calculateStandings } from "../lib/standings";

function GamesPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, teams } = useLeague();
  const [scheduleGames, setScheduleGames] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [gameActionError, setGameActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [openGameId, setOpenGameId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [presentationNow, setPresentationNow] = useState(Date.now());
  const progress = normalizeProgress(activeLeague, scheduleGames);
  const currentRoundGames = useMemo(
    () => scheduleGames.filter((game) => game.round === progress.currentRound),
    [progress.currentRound, scheduleGames],
  );
  const visibleGames = useMemo(
    () => visibleCompletedGames(scheduleGames, presentationNow),
    [presentationNow, scheduleGames],
  );
  const standings = useMemo(
    () => calculateStandings(teams, visibleGames, activeLeague?.season),
    [activeLeague?.season, teams, visibleGames],
  );
  const featuredCandidate = useMemo(
    () => selectFeaturedGame(scheduleGames, user.uid, progress.currentRound, presentationNow),
    [presentationNow, progress.currentRound, scheduleGames, user.uid],
  );
  const hasCurrentRoundMatchup = currentRoundGames.some((game) => getOfficialParticipantSide(game, user.uid));
  const featuredGame = currentRoundGames.length > 0 && !hasCurrentRoundMatchup && !progress.regularSeasonComplete
    ? null
    : featuredCandidate;
  const featuredStatus = getHubGameStatus(featuredGame, progress.currentRound, presentationNow);
  const featuredScore = getVisibleGameScore(featuredGame, presentationNow);
  const storyline = deriveMatchupStoryline(featuredGame, standings, scheduleGames, presentationNow);
  const userRow = standings.find((row) => row.teamUid === user.uid);
  const opponentUid = featuredGame?.homeUid === user.uid ? featuredGame?.awayUid : featuredGame?.homeUid;
  const opponentRow = standings.find((row) => row.teamUid === opponentUid);
  const timeline = useMemo(
    () => buildSeasonTimeline(scheduleGames, user.uid, progress.currentRound, presentationNow),
    [presentationNow, progress.currentRound, scheduleGames, user.uid],
  );
  const recentGame = [...visibleGames].reverse().find(
    (game) => getOfficialParticipantSide(game, user.uid),
  );
  const recentLeaders = getRecentGameLeaders(recentGame, presentationNow);
  const openGame = scheduleGames.find((game) => game.id === openGameId);
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const canStartRound = isCommissioner && !progress.regularSeasonComplete && (
    progress.roundStatus === ROUND_STATUS.PENDING ||
    (progress.roundStatus === ROUND_STATUS.COMPLETED && isRoundProgressionComplete(currentRoundGames))
  );
  const nextRound = progress.roundStatus === ROUND_STATUS.COMPLETED
    ? progress.currentRound + 1
    : progress.currentRound;
  const rounds = useMemo(() => summarizeRounds(scheduleGames), [scheduleGames]);
  const shownRound = selectedRound ?? progress.currentRound;
  const shownRoundGames = scheduleGames.filter((game) => game.round === shownRound);
  const remaining = currentRoundGames.filter(
    (game) => getHubGameStatus(game, progress.currentRound, presentationNow) !== GAME_HUB_STATUS.FINAL,
  ).length;
  const presentationClockActive = scheduleGames.some(
    (game) => game.timeline?.length && !isOfficialGameFinalVisible(game, presentationNow),
  );

  async function run(actionName, action) {
    setGameActionError("");
    setBusyAction(actionName);
    try {
      await action();
    } catch (error) {
      setGameActionError(getUserFriendlyError(error, "The official game could not be updated."));
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
    window.requestAnimationFrame(() => document.querySelector(".official-game-session")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
        reportClientError("Schedule", error);
        setScheduleError("The official schedule is currently unavailable.");
        setScheduleLoading(false);
      },
    );
  }, [activeLeague?.season, activeLeagueId]);

  const featuredAction = getFeaturedAction({
    busyAction,
    canStartRound,
    featuredGame,
    featuredStatus,
    nextRound,
    onOpen: openOfficialGame,
    onStart: () => run("round", () => startRegularSeasonRound({ leagueId: activeLeagueId })),
  });

  return (
    <PageLayout>
      <main className="game-night-hub">
        <GamesHeader season={activeLeague?.season} progress={progress} remaining={remaining} />
        {gameActionError && <p className="official-game-error" role="alert">{gameActionError}</p>}
        {openGame && <section className="official-game-session">
          <header><div><span>OFFICIAL GAMECAST · ROUND {openGame.round}</span><h2>{openGame.awayTeamName} at {openGame.homeTeamName}</h2></div><button type="button" onClick={() => setOpenGameId(null)}>Close Gamecast</button></header>
          <OfficialGamePresentation game={openGame} onPresentationComplete={() => finalizeOfficialGamePresentation({ leagueId: activeLeagueId, gameId: openGame.id })} renderFinal={() => <OfficialBoxScore game={openGame} />} />
        </section>}
        {scheduleLoading ? <div className="game-night-state">Loading game night...</div> : scheduleError ? <div className="game-night-state" role="alert">{scheduleError}</div> : scheduleGames.length === 0 ? (
          <EmptyGamesState leagueId={activeLeagueId} />
        ) : <>
          <FeaturedMatchup game={featuredGame} status={featuredStatus} score={featuredScore} standings={standings} storyline={storyline} action={featuredAction} />
          {isCommissioner && <CommissionerRoundControl progress={progress} canStartRound={canStartRound} nextRound={nextRound} busy={busyAction === "round"} onStart={() => run("round", () => startRegularSeasonRound({ leagueId: activeLeagueId }))} />}
          <div className="game-night-grid">
            <RoundScoreboard games={currentRoundGames} currentUid={user.uid} currentRound={progress.currentRound} now={presentationNow} statusFor={(game) => getHubGameStatus(game, progress.currentRound, presentationNow)} onOpen={openOfficialGame} sectionId="round-scoreboard" />
            <StakesPanel userRow={userRow} opponentRow={opponentRow} />
          </div>
          <SeasonTimeline items={timeline} onOpen={openOfficialGame} />
          <RecentLeaders game={recentGame} leaders={recentLeaders} />
          <section className="game-night-section full-schedule">
            <header><div><span>ACTIVE SEASON</span><h2>League Schedule</h2></div><Link to="/standings">View Standings</Link></header>
            <div className="round-selector" aria-label="Select schedule round">{rounds.map((round) => <button className={shownRound === round.round ? "is-active" : ""} key={round.round} onClick={() => setSelectedRound(round.round)} type="button"><b>R{round.round}</b><small>{round.label}</small></button>)}</div>
            <RoundScoreboard games={shownRoundGames} currentUid={user.uid} currentRound={progress.currentRound} now={presentationNow} statusFor={(game) => getHubGameStatus(game, progress.currentRound, presentationNow)} onOpen={openOfficialGame} showHeader={false} />
          </section>
        </>}
      </main>
    </PageLayout>
  );
}

function getFeaturedAction({ busyAction, canStartRound, featuredGame, featuredStatus, nextRound, onOpen, onStart }) {
  if (!featuredGame) return null;
  if ([GAME_HUB_STATUS.LIVE, GAME_HUB_STATUS.FINAL].includes(featuredStatus)) {
    return <button className="button-primary" disabled={busyAction === `game-${featuredGame.id}`} onClick={() => onOpen(featuredGame)} type="button">{featuredStatus === GAME_HUB_STATUS.LIVE ? "Watch Live" : "View Box Score"}</button>;
  }
  if (canStartRound && [GAME_HUB_STATUS.READY, GAME_HUB_STATUS.UPCOMING].includes(featuredStatus)) {
    return <button className="button-primary" disabled={Boolean(busyAction)} onClick={onStart} type="button">{busyAction === "round" ? "Starting..." : `Start Round ${nextRound}`}</button>;
  }
  return <a className="button-secondary" href="#round-scoreboard">View Matchup</a>;
}

function CommissionerRoundControl({ progress, canStartRound, nextRound, busy, onStart }) {
  const waiting = progress.roundStatus === ROUND_STATUS.ACTIVE || (progress.roundStatus === ROUND_STATUS.COMPLETED && !canStartRound);
  return <aside className="commissioner-round-control"><div><span>COMMISSIONER CONTROL</span><b>{progress.regularSeasonComplete ? "Regular season complete" : waiting ? `Round ${progress.currentRound} is in progress` : `Round ${nextRound} is available`}</b></div>{canStartRound && nextRound <= progress.totalRounds && <button className="button-secondary" disabled={busy} onClick={onStart} type="button">{busy ? "Starting..." : `Start Round ${nextRound}`}</button>}</aside>;
}

function EmptyGamesState({ leagueId }) {
  return <section className="game-night-state game-night-state--empty"><span>NO GAMES YET</span><h2>Your season schedule is not ready.</h2><p>Complete team setup and return to the league dashboard to continue.</p><Link className="button-primary" to={`/league/${leagueId}`}>Return to League</Link></section>;
}

function normalizeProgress(league, games) {
  if (league?.seasonProgress) return league.seasonProgress;
  const totalRounds = league?.schedule?.totalRounds || Math.max(1, ...games.map((game) => game.round));
  const firstIncomplete = Array.from({ length: totalRounds }, (_, index) => index + 1).find(
    (round) => games.some((game) => game.round === round && game.status !== "completed"),
  );
  const currentRound = firstIncomplete || totalRounds;
  const currentGames = games.filter((game) => game.round === currentRound);
  return {
    currentRound,
    totalRounds,
    roundStatus: currentGames.some((game) => game.status === "in_progress") ? ROUND_STATUS.ACTIVE : currentGames.length && currentGames.every((game) => game.status === "completed") ? ROUND_STATUS.COMPLETED : ROUND_STATUS.PENDING,
    regularSeasonComplete: games.length > 0 && games.every((game) => game.status === "completed"),
  };
}

function summarizeRounds(games) {
  const grouped = new Map();
  games.forEach((game) => grouped.set(game.round, [...(grouped.get(game.round) || []), game]));
  return [...grouped].map(([round, roundGames]) => ({
    round,
    label: roundGames.every((game) => game.status === "completed") ? "Final" : roundGames.some((game) => game.status === "in_progress") ? "Live" : "Upcoming",
  }));
}

function OfficialBoxScore({ game }) {
  const winnerName = game.result?.winnerUid === game.homeUid ? game.homeTeamName : game.awayTeamName;
  return <div className="official-box-score"><div className="official-box-score__final"><b>FINAL</b><strong>{game.awayTeamName} {game.result?.awayScore} - {game.result?.homeScore} {game.homeTeamName}</strong><span>Winner: {winnerName}</span></div>{[game.boxScore?.away, game.boxScore?.home].filter(Boolean).map((team) => <section key={team.uid}><h4>{team.teamName}</h4><small>Strategy: {team.strategy}</small>{team.players.map((player) => <p key={player.playerId}><b>{player.name}</b><span>{player.stats.points} PTS · {player.stats.rebounds} REB · {player.stats.assists} AST · {player.stats.steals} STL · {player.stats.blocks} BLK</span></p>)}</section>)}</div>;
}

export default GamesPage;
