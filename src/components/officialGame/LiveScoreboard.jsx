import { presentationPhase } from "../../lib/officialGamePresentation";

function phaseLabel(event) {
  if (event?.eventType === "quarter_end") return `END Q${event.quarter}`;
  return presentationPhase(event);
}

function LiveScoreboard({ game, event }) {
  const homePossession = event?.offenseUid === game.homeUid;
  const awayPossession = event?.offenseUid === game.awayUid;
  return (
    <header className="live-scoreboard">
      <div className={`live-scoreboard__team is-away${awayPossession ? " has-possession" : ""}`}>
        <small>AWAY</small><b>{game.awayTeamName}</b><strong>{event?.awayScore || 0}</strong>
      </div>
      <div className="live-scoreboard__clock">
        <b>{phaseLabel(event)}</b><span>{event?.gameClock || "12:00"}</span><small>OFFICIAL · 1X</small>
      </div>
      <div className={`live-scoreboard__team is-home${homePossession ? " has-possession" : ""}`}>
        <small>HOME</small><b>{game.homeTeamName}</b><strong>{event?.homeScore || 0}</strong>
      </div>
    </header>
  );
}

export default LiveScoreboard;
