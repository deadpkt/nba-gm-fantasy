import PlayerImage from "../player/PlayerImage";
import { formatMoney } from "../../lib/contracts";
import { freeAgentPositions, freeAgentTeamName } from "../../lib/freeAgencyPresentation";

function FreeAgentRow({ player, projectedContract, onView, onSign, signingState }) {
  return <article className="market-player-row">
    <button className="market-player-row__identity" type="button" onClick={() => onView(player)} aria-label={`View ${player.name} details`}>
      <PlayerImage player={player} className="market-player-row__portrait" />
      <span><b title={player.name}>{player.name}</b><small>{freeAgentPositions(player).join(" / ")} · {freeAgentTeamName(player)}</small></span>
    </button>
    <div className="market-player-row__overall"><strong>{player.overall}</strong><small>OVR</small></div>
    <div className="market-player-row__contract"><small>PROJECTED CONTRACT</small><b>{formatMoney(projectedContract.salary)}</b><span>{projectedContract.yearsRemaining} YEARS</span></div>
    <div className="market-player-row__actions"><button type="button" onClick={() => onView(player)}>View</button><button className="market-sign-button" type="button" disabled={signingState.disabled} title={signingState.detail} aria-label={`${signingState.label} ${player.name}`} onClick={() => onSign(player)}>{signingState.label}</button><small>{signingState.detail}</small></div>
  </article>;
}

export default FreeAgentRow;
