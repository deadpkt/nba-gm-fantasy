import {
  formatGameEvent,
  getRecentScoringRun,
} from "../../lib/officialGamePresentation";

export function CurrentPossession({ event, game, playersById }) {
  const teamName =
    event?.offenseUid === game.homeUid
      ? game.homeTeamName
      : event?.offenseUid === game.awayUid
        ? game.awayTeamName
        : "Awaiting possession";
  const player = playersById.get(String(event?.playerId));
  return (
    <section className="possession-panel">
      <p className="broadcast-label">POSSESSION</p>
      <h2>{teamName}</h2>
      <span>
        {player
          ? `${player.name} leads the possession.`
          : "The next play is developing."}
      </span>
    </section>
  );
}

export function LastPlay({ event, game, playersById }) {
  const play = formatGameEvent(event, { game, playersById });
  return (
    <section className="last-play" aria-live="polite" aria-atomic="true">
      <p className="broadcast-label">LAST PLAY</p>
      <h2 key={event?.sequence}>
        {play?.title || "Waiting for the opening tip."}
      </h2>
      {play?.detail && (
        <span>
          {play.detail}
          {play.scoreDelta > 0 ? ` +${play.scoreDelta}` : ""}
        </span>
      )}
    </section>
  );
}

export function PlayByPlayFeed({ events, game, playersById, limit = 12 }) {
  return (
    <section className="gamecast-feed">
      <div className="gamecast-section-heading">
        <h3>PLAY-BY-PLAY</h3>
        <span>LIVE</span>
      </div>
      <div className="gamecast-feed__list">
        {[...events]
          .reverse()
          .slice(0, limit)
          .map((event, index) => {
            const play = formatGameEvent(event, { game, playersById });
            return (
              <article
                className={`feed-row feed-row--${play.type}${index === 0 ? " is-latest" : ""}`}
                key={event.sequence}
              >
                <time>
                  <b>{play.clock}</b>
                  <small>{play.phase}</small>
                </time>
                <p>
                  {play.title}
                  <small>{play.detail}</small>
                </p>
                {play.scoreDelta > 0 && <strong>+{play.scoreDelta}</strong>}
              </article>
            );
          })}
      </div>
    </section>
  );
}

export function MomentumPanel({ events, game }) {
  const run = getRecentScoringRun(events, game);
  const total = run.home + run.away;
  const awayWidth = total ? (run.away / total) * 100 : 50;
  return (
    <section className="momentum-panel">
      <div className="gamecast-section-heading">
        <h3>RECENT RUN</h3>
        <span>LAST 8 SCORES</span>
      </div>
      <div className="momentum-score">
        <b>{game.awayTeamName}</b>
        <strong>{run.away}</strong>
        <i>/</i>
        <strong>{run.home}</strong>
        <b>{game.homeTeamName}</b>
      </div>
      <div
        className="momentum-track"
        aria-label={`${game.awayTeamName} ${run.away}, ${game.homeTeamName} ${run.home} in the recent scoring run`}
      >
        <i style={{ width: `${awayWidth}%` }} />
        <i />
      </div>
    </section>
  );
}

export function GameLeaders({ players, stats }) {
  const categories = [
    ["points", "POINTS", "PTS"],
    ["rebounds", "REBOUNDS", "REB"],
    ["assists", "ASSISTS", "AST"],
  ];
  return (
    <section className="game-leaders">
      <div className="gamecast-section-heading">
        <h3>GAME LEADERS</h3>
      </div>
      {categories.map(([key, label, suffix]) => {
        const leader = players.reduce((best, player) => {
          const value = stats[`${player.side}:${player.playerId}`]?.[key] || 0;
          return !best || value > best.value ? { player, value } : best;
        }, null);
        return (
          <div className="leader-row" key={key}>
            <span>{label}</span>
            <b>{leader?.player.name || "—"}</b>
            <strong>
              {leader?.value || 0} {suffix}
            </strong>
          </div>
        );
      })}
    </section>
  );
}

export function BreakState({ event, game }) {
  if (
    !event ||
    !["quarter_end", "halftime", "game_end"].includes(event.eventType)
  )
    return null;
  const label =
    event.eventType === "halftime"
      ? "HALFTIME"
      : event.eventType === "game_end"
        ? "FINAL BUZZER"
        : `END OF Q${event.quarter}`;
  return (
    <div className="broadcast-break" role="status">
      <span>{label}</span>
      <b>
        {game.awayTeamName} {event.awayScore}
      </b>
      <i>—</i>
      <b>
        {event.homeScore} {game.homeTeamName}
      </b>
    </div>
  );
}
