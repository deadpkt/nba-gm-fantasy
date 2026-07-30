import { Link } from "react-router-dom";
import useLeague from "../hooks/useLeague";
import useLeagueGuidance from "../hooks/useLeagueGuidance";
import { getLeagueProgress } from "../lib/leagueGuidance";

function LeagueProgress({ compact = false }) {
  const { activeLeague } = useLeague();
  const guidance = useLeagueGuidance();
  const steps = getLeagueProgress(activeLeague?.status);

  return (
    <section className={`league-guide ${compact ? "league-guide--compact" : ""}`} aria-label="League progress and next action">
      <div className="league-guide__action">
        <div>
          <span>NEXT ACTION</span>
          <h2>{guidance.title}</h2>
          <p>{guidance.description}</p>
          {guidance.blockedReason && <small>{guidance.blockedReason}</small>}
        </div>
        <Link className={`basketball-action basketball-action--${guidance.actionType}`} to={guidance.actionPath}>{guidance.actionLabel}<b aria-hidden="true">→</b></Link>
      </div>
      {!compact && activeLeague && (
        <div className="league-guide__journey">
          <span>LEAGUE PROGRESS</span>
          <ol>{steps.map((step) => <li className={`is-${step.state}`} key={step.status}><i>{step.state === "complete" ? "✓" : step.state === "active" ? "→" : "○"}</i><b>{step.label}</b></li>)}</ol>
        </div>
      )}
    </section>
  );
}

export default LeagueProgress;
