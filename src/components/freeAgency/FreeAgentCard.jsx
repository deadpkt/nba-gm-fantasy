function FreeAgentCard({ player, onView }) {
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
      {player.image ? (
        <img src={player.image} alt={player.name} />
      ) : (
        <div className="free-agent-card__portrait" aria-hidden="true">
          {player.position}
        </div>
      )}
      <div className="free-agent-card__identity">
        <small>
          {player.position} · {player.team || "FREE AGENT"}
        </small>
        <h3>{player.name}</h3>
        <span>AVAILABLE</span>
      </div>
      <div className="free-agent-card__actions">
        <button type="button" onClick={() => onView(player)}>
          View player
        </button>
        <button type="button" disabled title="Watchlists are not available yet">
          Add to Watchlist
        </button>
      </div>
    </article>
  );
}

export default FreeAgentCard;
