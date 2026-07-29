function PlayerHeader({ player }) {
  const accent = player.color || "#e32842";
  return (
    <header
      className="player-details__header"
      style={{ "--player-accent": accent }}
    >
      <div className="player-details__portrait">
        <img src={player.image} alt={player.name} />
      </div>
      <div className="player-details__identity">
        <span>
          {player.position || "—"} · {player.team || "—"}
          {player.number ? ` · #${player.number}` : ""}
        </span>
        <h2>{player.name}</h2>
        <p>{player.archetype || "Player profile"}</p>
      </div>
      <div
        className={`player-details__overall ${player.overall >= 94 ? "is-elite" : ""}`}
      >
        <b>{player.overall ?? "—"}</b>
        <small>OVR</small>
      </div>
    </header>
  );
}
export default PlayerHeader;
