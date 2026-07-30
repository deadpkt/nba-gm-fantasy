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
        <span>NBA DATA</span>
        <b>
          {source.available === false
            ? "Premium statistics unavailable"
            : `Season ${source.season || "production"}`}
        </b>
      </div>
      {source.available === false ? (
        <p className="player-stats__unavailable">
          Directory identity is synchronized. NBA statistics are unavailable
          from the configured provider tier and have not been fabricated.
        </p>
      ) : (
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
      )}
    </section>
  );
}
export default PlayerStats;
