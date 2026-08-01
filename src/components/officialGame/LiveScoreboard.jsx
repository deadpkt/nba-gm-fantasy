import { presentationPhase } from "../../lib/officialGamePresentation";

function phaseLabel(event) {
  if (event?.eventType === "quarter_end") return `END Q${event.quarter}`;
  return presentationPhase(event);
}

function LiveScoreboard({ game, event }) {
  const homePossession = event?.offenseUid === game.homeUid;
  const awayPossession = event?.offenseUid === game.awayUid;
  return (
    <header className="broadcast-scoreboard" aria-label="Live game score">
      <div className={`broadcast-team is-away${awayPossession ? " has-possession" : ""}`}>
        <span className="broadcast-team__identity"><small>AWAY</small><b title={game.awayTeamName}>{game.awayTeamName}</b></span>
        <strong aria-label={`${event?.awayScore || 0} points`}>{event?.awayScore || 0}</strong>
        <em>{awayPossession ? "POSSESSION" : ""}</em>
      </div>
      <div className="broadcast-clock">
        <b>{phaseLabel(event)}</b>
        <time aria-label={`Game clock ${event?.gameClock || "12:00"}`}>{event?.gameClock || "12:00"}</time>
        <small>{event?.eventType === "game_end" ? "OFFICIAL FINAL" : "LIVE · OFFICIAL"}</small>
      </div>
      <div className={`broadcast-team is-home${homePossession ? " has-possession" : ""}`}>
        <strong aria-label={`${event?.homeScore || 0} points`}>{event?.homeScore || 0}</strong>
        <span className="broadcast-team__identity"><small>HOME</small><b title={game.homeTeamName}>{game.homeTeamName}</b></span>
        <em>{homePossession ? "POSSESSION" : ""}</em>
      </div>
    </header>
  );
}

export default LiveScoreboard;
