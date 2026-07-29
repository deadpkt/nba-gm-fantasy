function PlayerCard({
  player,
  actionLabel = "Add to team",
  onAction,
  disabled = false,
}) {
  const { name, position, team, overall, stats, image, color } = player;

  return (
    <article
      className="player-card"
      style={{ "--accent-color": color }}
      onClick={() => openPlayerDetails(player)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && event.key === "Enter") {
          openPlayerDetails(player);
        }
      }}
      role="button"
      tabIndex="0"
    >
      <div className="card-glow" />
      <div className="card-grain" />
      <span className="card-number" aria-hidden="true">
        {String(overall).padStart(2, "0")}
      </span>
      <div className="player-card__top">
        <span>
          {position} / {team}
        </span>
        <strong>
          {overall}
          <small>OVR</small>
        </strong>
      </div>
      <div className="player-card__team-mark" aria-hidden="true">
        {team}
      </div>
      <img className="player-card__image" src={image} alt={name} />
      <div className="player-card__details">
        <p className="player-card__role">STARTING FIVE CANDIDATE</p>
        <h2>{name}</h2>
        <div className="player-card__stats">
          <span>
            <b>{stats.points}</b> PPG
          </span>
          <span>
            <b>{stats.rebounds}</b> RPG
          </span>
          <span>
            <b>{stats.assists}</b> APG
          </span>
        </div>
        {onAction && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAction(player);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            disabled={disabled}
          >
            {actionLabel} <span>{actionLabel === "Remove" ? "x" : "+"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export default PlayerCard;
import { openPlayerDetails } from "./player/PlayerDetailsModal";
