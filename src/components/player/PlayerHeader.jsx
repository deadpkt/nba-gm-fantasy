import PlayerImage from "./PlayerImage";

function PlayerHeader({ player }) {
  const accent = player.color || "#e32842";
  const positions =
    (player.eligiblePositions || [player.position])
      .filter(Boolean)
      .join(" / ") || "—";
  const team = player.providerData?.nbaTeam?.abbreviation || player.team || "—";
  return (
    <header
      className="player-details__header"
      style={{ "--player-accent": accent }}
    >
      <div className="player-details__portrait">
        <PlayerImage player={player} />
      </div>
      <div className="player-details__identity">
        <span>
          {positions} · {team}
          {player.number ? ` · #${player.number}` : ""}
        </span>
        <h2>{player.name}</h2>
        <p>
          {player.providerData?.nbaTeam?.fullName ||
            player.archetype ||
            "NBA player directory"}
        </p>
      </div>
      <div
        className={`player-details__overall ${player.overall >= 94 ? "is-elite" : ""}`}
      >
        <b>{player.overall ?? "—"}</b>
        <small>GAME OVR</small>
      </div>
    </header>
  );
}
export default PlayerHeader;
