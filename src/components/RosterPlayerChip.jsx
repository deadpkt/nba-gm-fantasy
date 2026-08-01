import { openPlayerDetails } from "./player/PlayerDetailsModal";
import PlayerImage from "./player/PlayerImage";

function RosterPlayerChip({ player, rotationLabel }) {
  const positions = player.eligiblePositions?.length
    ? player.eligiblePositions.join(" / ")
    : player.primaryPosition || player.position || "Player";

  return (
    <button
      type="button"
      className="roster-player-chip"
      onClick={() => openPlayerDetails(player)}
      title={player.name}
      aria-label={`View ${player.name} details`}
    >
      <span className="roster-player-chip__portrait"><PlayerImage player={player} alt="" /><i>{rotationLabel}</i></span>
      <span><b>{player.name}</b><small>{positions}</small></span>
      <strong>{player.overall ?? "—"}<small> OVR</small></strong>
    </button>
  );
}

export default RosterPlayerChip;
