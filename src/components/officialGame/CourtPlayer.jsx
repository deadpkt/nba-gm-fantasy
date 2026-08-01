function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function CourtPlayer({ player, position, role = "stationary", hasBall }) {
  return (
    <div
      className={`court-marker court-marker--${player.side} movement-${role}${role === "primary" || role === "defender" ? " is-active" : ""}${hasBall ? " has-ball" : ""}`}
      style={{ "--court-x": `${position.x}%`, "--court-y": `${position.y}%` }}
    >
      <b>{initials(player.name)}</b>
      <span>{player.name}</span>
      <small>
        {player.position} · {player.side.toUpperCase()}
      </small>
    </div>
  );
}

export default CourtPlayer;
