import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import OfficialGamePresentation from "../components/OfficialGamePresentation";
import PageLayout from "../components/PageLayout";
import {
  BracketGameCard,
  ChampionCard,
  ChampionshipProgress,
  FeaturedPlayoffMatchup,
  PlayoffResults,
  PlayoffsHeader,
  UserPlayoffState,
} from "../components/playoffs/ChampionshipHub";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { getUserFriendlyError } from "../lib/clientErrors";
import { isOfficialGameFinalVisible } from "../lib/officialGamePresentation";
import { finalizeOfficialGamePresentation, getOfficialParticipantSide, startPlayoffRound } from "../lib/officialGames";
import { playoffDisplayStatus, playoffUserOutcome, PLAYOFF_DISPLAY_STATUS, selectFeaturedPlayoffGame } from "../lib/playoffPresentation";
import { enterOffseason } from "../lib/seasonHistory";
import "../playoffs.css";

function PlayoffsPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague } = useLeague();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openGameId, setOpenGameId] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [presentationNow, setPresentationNow] = useState(Date.now());
  const postseason = activeLeague?.postseason;
  const playoffGames = useMemo(
    () => games.filter((game) => ["semifinal", "final"].includes(game.stage) && game.season === activeLeague?.season),
    [activeLeague?.season, games],
  );
  const semifinals = playoffGames.filter((game) => game.stage === "semifinal").sort((a, b) => a.playoffGameKey.localeCompare(b.playoffGameKey));
  const final = playoffGames.find((game) => game.stage === "final");
  const openGame = playoffGames.find((game) => game.id === openGameId);
  const featuredGame = selectFeaturedPlayoffGame(playoffGames, user.uid, presentationNow);
  const championVisible = postseason?.status === "completed" && final && isOfficialGameFinalVisible(final, presentationNow);
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const stageGames = postseason?.status === "semifinals" ? semifinals : final ? [final] : [];
  const expectedStageGames = postseason?.status === "semifinals" ? 2 : 1;
  const canStart = isCommissioner && ["semifinals", "finals"].includes(postseason?.status) && stageGames.length === expectedStageGames && stageGames.every((game) => game.status === "scheduled");
  const presentationClockActive = playoffGames.some((game) => game.timeline?.length && !isOfficialGameFinalVisible(game, presentationNow));
  const userOutcome = playoffUserOutcome({ postseason, games: playoffGames, uid: user.uid, now: presentationNow });
  const stageLabel = championVisible ? "Champion crowned" : postseason?.status === "finals" ? "League Final" : postseason?.status === "semifinals" ? "Semifinals" : "Championship pending";

  useEffect(() => {
    if (!activeLeagueId || !activeLeague?.season) {
      setGames([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(query(collection(db, "leagues", activeLeagueId, "games"), where("season", "==", activeLeague.season)), (snapshot) => {
      setGames(snapshot.docs.map((game) => ({ id: game.id, ...game.data() })));
      setLoading(false);
    }, () => {
      setError("The playoff bracket is currently unavailable.");
      setLoading(false);
    });
  }, [activeLeague?.season, activeLeagueId]);

  useEffect(() => {
    if (!presentationClockActive) return undefined;
    const interval = window.setInterval(() => setPresentationNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [presentationClockActive]);

  async function run(name, action) {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (nextError) {
      setError(getUserFriendlyError(nextError, "The playoff action could not be completed."));
    } finally {
      setBusy("");
    }
  }

  function open(game) {
    if (!getOfficialParticipantSide(game, user.uid)) return;
    setOpenGameId(game.id);
    window.requestAnimationFrame(() => document.querySelector(".playoff-presentation")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const featuredStatus = playoffDisplayStatus(featuredGame, presentationNow);
  const featuredParticipant = getOfficialParticipantSide(featuredGame, user.uid);
  const featuredAction = featuredParticipant && [PLAYOFF_DISPLAY_STATUS.LIVE, PLAYOFF_DISPLAY_STATUS.FINAL].includes(featuredStatus)
    ? <button className="button-primary" onClick={() => open(featuredGame)} type="button">{featuredStatus === PLAYOFF_DISPLAY_STATUS.LIVE ? "Watch Game" : "View Result"}</button>
    : canStart && featuredStatus === PLAYOFF_DISPLAY_STATUS.UPCOMING
      ? <button className="button-primary" disabled={Boolean(busy)} onClick={() => run("round", () => startPlayoffRound({ leagueId: activeLeagueId }))} type="button">{busy === "round" ? "Starting..." : postseason.status === "semifinals" ? "Start Semifinals" : "Start Final"}</button>
      : null;

  return <PageLayout><main className="championship-hub">
    <PlayoffsHeader season={activeLeague?.season} stage={stageLabel} champion={championVisible} />
    <ChampionshipProgress champion={championVisible} />
    {error && <p className="playoffs-error" role="alert">{error}</p>}
    {openGame && <section className="playoff-presentation"><header><div><span>{openGame.stage === "final" ? "LEAGUE FINAL" : "SEMIFINAL"}</span><h2>{openGame.awayTeamName} at {openGame.homeTeamName}</h2></div><button type="button" onClick={() => setOpenGameId(null)}>Close Gamecast</button></header><OfficialGamePresentation game={openGame} onPresentationComplete={() => finalizeOfficialGamePresentation({ leagueId: activeLeagueId, gameId: openGame.id })} renderFinal={() => <GameFinal game={openGame} />} /></section>}
    {loading ? <PlayoffsSkeleton /> : playoffGames.length === 0 ? <PlayoffsLocked /> : <>
      {championVisible && <ChampionCard postseason={postseason} season={activeLeague.season} finalGame={final} commissioner={isCommissioner} busy={busy === "offseason"} onOffseason={() => run("offseason", () => enterOffseason({ leagueId: activeLeagueId }))} />}
      <UserPlayoffState outcome={userOutcome} />
      {!championVisible && <FeaturedPlayoffMatchup game={featuredGame} now={presentationNow} action={featuredAction} />}
      {canStart && featuredStatus !== PLAYOFF_DISPLAY_STATUS.UPCOMING && <aside className="playoff-round-control"><div><span>COMMISSIONER CONTROL</span><b>{postseason.status === "semifinals" ? "Semifinals ready" : "League Final ready"}</b></div><button className="button-secondary" disabled={Boolean(busy)} onClick={() => run("round", () => startPlayoffRound({ leagueId: activeLeagueId }))} type="button">{busy === "round" ? "Starting..." : "Start Round"}</button></aside>}
      <section className={`championship-bracket ${semifinals.length ? "has-semifinals" : "finals-only"}`}><header><span>CHAMPIONSHIP BRACKET</span><h2>Road to the Title</h2></header><div className="championship-bracket__rounds">{semifinals.length > 0 && <section><h3>SEMIFINALS</h3>{semifinals.map((game) => <BracketGameCard game={game} now={presentationNow} currentUid={user.uid} onOpen={open} key={game.id} />)}</section>}<section><h3>LEAGUE FINAL</h3><BracketGameCard game={final} now={presentationNow} currentUid={user.uid} onOpen={open} /></section></div></section>
      <PlayoffResults games={playoffGames} now={presentationNow} />
    </>}
  </main></PageLayout>;
}

function PlayoffsSkeleton() {
  return <div className="playoffs-skeleton" aria-label="Loading playoff bracket"><div /><div /><section><i /><i /></section></div>;
}

function PlayoffsLocked() {
  return <section className="playoffs-locked"><span>PLAYOFFS LOCKED</span><h2>Finish the regular season.</h2><p>The trusted championship bracket will appear when final seeds are ready.</p></section>;
}

function GameFinal({ game }) {
  return <div className="playoff-final-score"><b>FINAL</b><strong>{game.awayTeamName} {game.result?.awayScore} — {game.result?.homeScore} {game.homeTeamName}</strong></div>;
}

export default PlayoffsPage;
