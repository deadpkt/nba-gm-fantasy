const stats = [
  ["PPG", "points"],
  ["RPG", "rebounds"],
  ["APG", "assists"],
  ["SPG", "steals"],
  ["BPG", "blocks"],
  ["FG%", "fieldGoalPercentage"],
  ["3PT%", "threePointPercentage"],
  ["FT%", "freeThrowPercentage"],
];
const display = (value) =>
  Number.isFinite(value)
    ? `${value <= 1 && value > 0 ? Math.round(value * 100) : value}%`
    : "—";
function PlayerStats({ player }) {
  const source = player.stats || {};
  return (
    <section className="player-details__section">
      <div className="player-details__section-head">
        <span>SEASON PRODUCTION</span>
        <b>Player statistics</b>
      </div>
      <div className="player-stats">
        {stats.map(([label, key]) => (
          <div key={key}>
            <span>{label}</span>
            <b>
              {label.includes("%")
                ? display(source[key])
                : Number.isFinite(source[key])
                  ? source[key].toFixed(1)
                  : "—"}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
export default PlayerStats;
