import PlayerImage from "../player/PlayerImage";
import { formatMoney } from "../../lib/contracts";

function FreeAgentCard({ player, projectedContract, onView, onSign, signing, disabledReason }) {
  return (
    <article
      className="free-agent-card"
      style={{ "--agent-color": player.color || "#e32842" }}
    >
      <div className="free-agent-card__top">
        <span>FREE AGENT</span>
        <b>
          {player.overall}
          <small>OVR</small>
        </b>
      </div>
      <PlayerImage player={player} className="free-agent-card__portrait" />
      <div className="free-agent-card__identity">
        <small>
          {player.position} · {player.team || "FREE AGENT"}
        </small>
        <h3>{player.name}</h3>
        <span>{formatMoney(projectedContract.salary)} / {projectedContract.yearsRemaining} YEARS</span>
      </div>
      <div className="free-agent-card__actions">
        <button type="button" onClick={() => onView(player)}>
          View player
        </button>
        <button type="button" disabled={Boolean(signing || disabledReason)} title={disabledReason || "Sign this player"} onClick={() => onSign(player)}>
          {signing ? "Signing..." : disabledReason || "Sign"}
        </button>
      </div>
    </article>
  );
}

export default FreeAgentCard;
