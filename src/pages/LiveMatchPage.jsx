import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import { db } from "../lib/firebase";
import {
  advanceMatchSimulation,
  saveUserMatchHistory,
} from "../lib/matches";
import { formatClock, getPlayerRatings } from "../utils/liveSimulation";

function LiveMatchPage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const savedHistoryRef = useRef(null);
  const game = match?.simulation;
  const gameClock = game?.clock;
  const gamePossession = game?.possession;
  const gameCompleted = game?.completed;
  const [displayClock, setDisplayClock] = useState(game?.clock ?? 180);
  const isHost = match?.hostUid === user.uid;

  useEffect(
    () =>
      onSnapshot(
        doc(db, "matches", matchId),
        (snapshot) =>
          setMatch(
            snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
          ),
        () => setError("Unable to load this live match."),
      ),
    [matchId],
  );

  useEffect(() => {
    if (gameClock !== undefined) setDisplayClock(gameClock);
  }, [gamePossession, gameClock]);

  useEffect(() => {
    if (gameClock === undefined || gameCompleted) return undefined;

    const timer = setInterval(
      () => setDisplayClock((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [gameClock, gameCompleted, gamePossession]);

  useEffect(() => {
    if (
      !isHost ||
      gameClock === undefined ||
      gameCompleted ||
      match?.status !== "in_progress"
    )
      return undefined;

    const interval = setInterval(() => {
      advanceMatchSimulation(matchId, user.uid).catch((nextError) =>
        setError(nextError.message),
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [isHost, gameClock, gameCompleted, match?.status, matchId, user.uid]);

  useEffect(() => {
    if (
      !gameCompleted ||
      !match?.result ||
      !match.completedAt ||
      savedHistoryRef.current === match.id
    )
      return;

    savedHistoryRef.current = match.id;
    saveUserMatchHistory(match, user.uid).catch((nextError) => {
      savedHistoryRef.current = null;
      setError(`Could not save match history: ${nextError.message}`);
    });
  }, [gameCompleted, match, user.uid]);

  const homeWinner = game?.completed && game.homeScore > game.awayScore;
  const awayWinner = game?.completed && game.awayScore > game.homeScore;
  const events = useMemo(
    () => [...(game?.events || [])].reverse(),
    [game?.events],
  );

  if (!match && !error)
    return (
      <PageLayout>
        <div className="route-loader">Entering the arena...</div>
      </PageLayout>
    );

  if (!match || !game)
    return (
      <PageLayout>
        <section className="empty-state">
          <h2>Live match unavailable.</h2>
          <p>{error || "The game has not started yet."}</p>
          <Link to={`/match/${matchId}`}>Return to match room</Link>
        </section>
      </PageLayout>
    );

  return (
    <PageLayout>
      <section className="live-arena">
        <div className="live-arena__lights" />
        <p className="section-label">ONLINE LIVE MATCH</p>
        <div className="live-scoreboard">
          <ScoreTeam
            side="home"
            team={match.host}
            score={game.homeScore}
            winner={homeWinner}
          />
          <div className="live-clock">
            <span>{game.completed ? "FINAL" : "LIVE"}</span>
            <b>{formatClock(displayClock)}</b>
            <small>
              {game.clock <= 45
                ? "CLUTCH TIME"
                : game.clock <= 120
                  ? "MID GAME"
                  : "OPENING RUN"}
            </small>
          </div>
          <ScoreTeam
            side="away"
            team={match.guest}
            score={game.awayScore}
            winner={awayWinner}
          />
        </div>
        <div className="live-possession">
          <span>
            {game.completed
              ? "GAME COMPLETE"
              : `${isHost ? "HOST SIMULATION" : "SPECTATING LIVE"} - possession ${game.possession + 1} of 45`}
          </span>
          <i>{game.completed ? "FINAL BUZZER" : "LIVE FEED"}</i>
        </div>
      </section>
      <section className="live-content">
        <div className="live-main">
          <div className="live-team-cards">
            <LineupCards
              label={match.host.name}
              players={match.host.players}
              stats={game.homeStats}
            />
            <LineupCards
              label={match.guest.name}
              players={match.guest.players}
              stats={game.awayStats}
            />
          </div>
          {game.completed && (
            <FinalPanel game={game} home={match.host} away={match.guest} />
          )}
        </div>
        <aside className="event-feed">
          <div className="event-feed__head">
            <span>GAME FLOW</span>
            <b>LIVE EVENTS</b>
          </div>
          {events.map((event) => (
            <article className={`event event--${event.type}`} key={event.id}>
              <time>{event.clock}</time>
              <div>
                <small>
                  {event.phase === "clutch"
                    ? "CLUTCH MOMENT"
                    : event.phase === "mid"
                      ? "MID GAME"
                      : "EARLY GAME"}
                </small>
                <p>{event.text}</p>
              </div>
              <b>
                {event.homeScore} - {event.awayScore}
              </b>
            </article>
          ))}
        </aside>
      </section>
    </PageLayout>
  );
}

function ScoreTeam({ team, score, side, winner }) {
  return (
    <div className={`live-score-team ${side} ${winner ? "winner" : ""}`}>
      <span>{side === "home" ? "HOME" : "AWAY"}</span>
      <b>{team.name}</b>
      <strong>{score}</strong>
    </div>
  );
}

function LineupCards({ label, players, stats }) {
  return (
    <section className="live-lineup">
      <header>
        <span>STARTING FIVE</span>
        <b>{label}</b>
      </header>
      {players.map((player) => {
        const stat = stats?.[player.id] || {};
        const ratings = getPlayerRatings(player);
        return (
          <article
            className="live-player"
            style={{ "--player-color": player.color }}
            key={player.id}
          >
            <img src={player.image} alt="" />
            <div>
              <span>
                {player.position} / {player.overall} OVR
              </span>
              <b>{player.name}</b>
              <small>
                {stat.points || 0} PTS / {stat.rebounds || 0} REB /{" "}
                {stat.assists || 0} AST
              </small>
            </div>
            <i
              title={`Shooting ${ratings.shooting}, Defense ${ratings.defense}, Clutch ${ratings.clutch}, Stamina ${ratings.stamina}`}
            >
              {ratings.shooting}
            </i>
          </article>
        );
      })}
    </section>
  );
}

function FinalPanel({ game, home, away }) {
  const winner = game.homeScore > game.awayScore ? home : away;
  return (
    <section className="final-panel">
      <p className="section-label">FINAL RESULT</p>
      <h2>
        {winner.name} <span>wins the matchup.</span>
      </h2>
      {game.mvp && (
        <div className="final-mvp">
          <img src={game.mvp.image} alt={game.mvp.name} />
          <div>
            <span>GAME MVP</span>
            <b>{game.mvp.name}</b>
            <small>
              {game.mvp.position} / {game.mvp.overall} OVR
            </small>
          </div>
        </div>
      )}
      <div className="final-team-stats">
        <TeamStats label={home.name} stats={game.homeTeamStats} />
        <TeamStats label={away.name} stats={game.awayTeamStats} />
      </div>
    </section>
  );
}

function TeamStats({ label, stats }) {
  const fieldGoalPercentage = stats.fieldGoalsAttempted
    ? Math.round((stats.fieldGoalsMade / stats.fieldGoalsAttempted) * 100)
    : 0;

  return (
    <div>
      <b>{label}</b>
      <span>{fieldGoalPercentage}% FG</span>
      <span>{stats.rebounds} REB</span>
      <span>{stats.assists} AST</span>
      <span>{stats.turnovers} TO</span>
    </div>
  );
}

export default LiveMatchPage;
