import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import OfficialGamePresentation from "../components/OfficialGamePresentation";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { isOfficialGameFinalVisible } from "../lib/officialGamePresentation";
import { finalizeOfficialGamePresentation, getOfficialParticipantSide, startPlayoffRound } from "../lib/officialGames";
import { enterOffseason } from "../lib/seasonHistory";
import "../playoffs.css";

function PlayoffsPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague } = useLeague();
  const [games, setGames] = useState([]);
  const [openGameId, setOpenGameId] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [presentationNow, setPresentationNow] = useState(Date.now());
  const postseason = activeLeague?.postseason;
  const playoffGames = games.filter((game) => ["semifinal", "final"].includes(game.stage) && game.season === activeLeague?.season);
  const semifinals = playoffGames.filter((game) => game.stage === "semifinal").sort((a, b) => a.playoffGameKey.localeCompare(b.playoffGameKey));
  const final = playoffGames.find((game) => game.stage === "final");
  const openGame = playoffGames.find((game) => game.id === openGameId);
  const championVisible = postseason?.status === "completed" && final && isOfficialGameFinalVisible(final, presentationNow);
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const canStart = activeLeague?.commissionerUid === user.uid && ["semifinals", "finals"].includes(postseason?.status) && (postseason.status === "semifinals" ? semifinals : [final]).every((game) => game?.status === "scheduled");
  const presentationClockActive = playoffGames.some((game) => game.timeline?.length && !isOfficialGameFinalVisible(game, presentationNow));

  useEffect(() => {
    if (!activeLeagueId || !activeLeague?.season) return undefined;
    return onSnapshot(query(collection(db, "leagues", activeLeagueId, "games"), where("season", "==", activeLeague.season)), (snapshot) => {
    setGames(snapshot.docs.map((game) => ({ id: game.id, ...game.data() })));
    }, () => setError("The playoff bracket is currently unavailable."));
  }, [activeLeague?.season, activeLeagueId]);
  useEffect(() => {
    if (!presentationClockActive) return undefined;
    const interval = window.setInterval(() => setPresentationNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [presentationClockActive]);

  async function run(name, action) {
    setBusy(name); setError("");
    try { await action(); } catch (nextError) { setError(nextError.message); } finally { setBusy(""); }
  }

  function open(game) {
    if (!getOfficialParticipantSide(game, user.uid)) return;
    setOpenGameId(game.id);
  }

  return <PageLayout>
    <section className="page-hero playoffs-hero"><p className="section-label">SEASON {activeLeague?.season}</p><h1>League <span>playoffs.</span></h1><p>Single-elimination basketball. Every official result is trusted and final.</p></section>
    <section className="playoffs-shell">
      <header><div><span>POSTSEASON</span><b>{championVisible ? "CHAMPIONSHIP COMPLETE" : postseason?.status === "completed" ? "FINALIZING CHAMPIONSHIP" : postseason?.status?.toUpperCase()}</b></div>{canStart && <button className="button-primary" disabled={Boolean(busy)} onClick={() => run("round", () => startPlayoffRound({ leagueId: activeLeagueId }))}>{busy === "round" ? "Starting..." : postseason.status === "semifinals" ? "Start Semifinals" : "Start Finals"}</button>}</header>
      {error && <p className="playoffs-error" role="alert">{error}</p>}
      {championVisible && <section className="champion-card"><span>SEASON {activeLeague.season} CHAMPION</span><strong>🏆</strong><h2>{postseason.champion.teamName}</h2><b>SEED #{postseason.champion.seed}</b><p>Runner-up: {postseason.runnerUp.teamName}</p><p>Final: {final.homeTeamName} {final.result.homeScore} — {final.awayTeamName} {final.result.awayScore}</p>{isCommissioner ? <button className="button-primary" disabled={Boolean(busy)} onClick={() => run("offseason", () => enterOffseason({ leagueId: activeLeagueId }))}>{busy === "offseason" ? "Creating Season History..." : "Enter Offseason"}</button> : <small>Waiting for the commissioner to begin offseason.</small>}</section>}
      <div className={`playoff-bracket ${semifinals.length ? "has-semifinals" : "finals-only"}`}>
        {semifinals.length > 0 && <section><h2>SEMIFINALS</h2>{semifinals.map((game) => <PlayoffGame game={game} user={user} busy={busy} now={presentationNow} onOpen={open} key={game.id} />)}</section>}
        <section><h2>FINALS</h2>{final ? <PlayoffGame game={final} user={user} busy={busy} now={presentationNow} onOpen={open} /> : <div className="playoff-game is-pending"><span>FINAL MATCHUP</span><b>Awaiting semifinal winners</b></div>}</section>
      </div>
      {openGame && <section className="playoff-presentation"><span>{openGame.stage === "final" ? "FINALS" : "SEMIFINAL"}</span><OfficialGamePresentation game={openGame} onPresentationComplete={() => finalizeOfficialGamePresentation({ leagueId: activeLeagueId, gameId: openGame.id })} renderFinal={() => <GameFinal game={openGame} />} /></section>}
    </section>
  </PageLayout>;
}

function PlayoffGame({ game, user, busy, now, onOpen }) {
  const participant = getOfficialParticipantSide(game, user.uid);
  const finalVisible = isOfficialGameFinalVisible(game, now);
  return <article className={`playoff-game is-${game.status}`}><span>{game.stage === "final" ? "LEAGUE FINAL" : game.playoffGameKey.toUpperCase()}</span><div><b><i>#{game.awaySeed}</i>{game.awayTeamName}</b>{finalVisible && <strong>{game.result.awayScore}</strong>}</div><div><b><i>#{game.homeSeed}</i>{game.homeTeamName}</b>{finalVisible && <strong>{game.result.homeScore}</strong>}</div><footer><em>{finalVisible ? "FINAL" : game.timeline?.length || game.status === "in_progress" ? "LIVE" : "SCHEDULED"}</em>{participant && ["in_progress", "completed"].includes(game.status) && <button disabled={busy === game.id} onClick={() => onOpen(game)}>{busy === game.id ? "Preparing..." : finalVisible ? "View Result" : "Watch Live"}</button>}</footer></article>;
}

function GameFinal({ game }) { return <div className="playoff-final-score"><b>FINAL</b><strong>{game.awayTeamName} {game.result?.awayScore} — {game.result?.homeScore} {game.homeTeamName}</strong></div>; }
export default PlayoffsPage;
