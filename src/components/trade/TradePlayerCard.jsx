import { openPlayerDetails } from "../player/PlayerDetailsModal";

function TradePlayerCard({
  player,
  selected,
  disabled,
  onToggle,
  actionLabel = "Add to offer",
}) {
  return (
    <article
      className={`trade-player-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      style={{ "--trade-color": player.color || "#e32842" }}
    >
      <button
        type="button"
        className="trade-player-card__profile"
        onClick={() => openPlayerDetails(player)}
        aria-label={`View ${player.name} details`}
      >
        <img src={player.image} alt="" />
        <span>
          <small>
            {player.position} · {player.team}
          </small>
          <b>{player.name}</b>
        </span>
        <strong>
          {player.overall}
          <i>OVR</i>
        </strong>
      </button>
      <button
        type="button"
        className="trade-player-card__action"
        onClick={() => onToggle(player)}
        disabled={disabled}
      >
        {selected ? "Remove" : actionLabel}
      </button>
    </article>
  );
}
export default TradePlayerCard;
