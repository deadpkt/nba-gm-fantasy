import { memo } from "react";
import { openPlayerDetails } from "./player/PlayerDetailsModal";
import PlayerImage from "./player/PlayerImage";

function PlayerCard({
  player,
  actionLabel = "Add to team",
  onAction,
  disabled = false,
  compact = false,
}) {
  const { name, position, team, overall, stats, color } = player;

  function runAction(event) {
    event.stopPropagation();
    onAction(player);
  }

  return (
    <article
      className={`player-card ${compact ? "player-card--compact" : ""}`}
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
      {compact ? <>
        <PlayerImage className="player-card__image" player={player} />
        <div className="player-card__compact-identity"><h2>{name}</h2><span>{team} · {position}{player.age ? ` · Age ${player.age}` : ""}</span></div>
        <strong className="player-card__compact-overall">{overall}<small>OVR</small></strong>
        {onAction && <button className="player-card__compact-action" type="button" onClick={runAction} onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} disabled={disabled}>{actionLabel}</button>}
      </> : <>
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
      <PlayerImage className="player-card__image" player={player} />
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
            onClick={runAction}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            disabled={disabled}
          >
            {actionLabel} <span>{actionLabel === "Remove" ? "x" : "+"}</span>
          </button>
        )}
      </div>
      </>}
    </article>
  );
}

export default memo(PlayerCard);
