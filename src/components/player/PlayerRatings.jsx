const ratings = [
  ["Inside Scoring", "insideScoring"],
  ["Mid Range", "midRange"],
  ["Three Point", "threePoint"],
  ["Free Throw", "freeThrow"],
  ["Playmaking", "playmaking"],
  ["Ball Handle", "ballHandle"],
  ["Passing", "passing"],
  ["Perimeter Defense", "perimeterDefense"],
  ["Interior Defense", "interiorDefense"],
  ["Rebounding", "rebounding"],
  ["Athleticism", "athleticism"],
  ["Stamina", "stamina"],
];
function PlayerRatings({ player }) {
  const source = player.ratings || {};
  const aliases = { insideScoring: "scoring", midRange: "shooting", threePoint: "shooting", freeThrow: "shooting", ballHandle: "playmaking", passing: "playmaking", perimeterDefense: "defense", interiorDefense: "defense", athleticism: "stamina" };
  return (
    <section className="player-details__section">
      <div className="player-details__section-head">
        <span>GAME RATINGS</span>
        <b>Fantasy simulation attributes</b>
      </div>
      <div className="player-ratings">
        {ratings.map(([label, key]) => {
          const value = Number.isFinite(source[key]) ? source[key] : Number.isFinite(source[aliases[key]]) ? source[aliases[key]] : null;
          return (
            <div className="player-rating" key={key}>
              <span>{label}</span>
              <b>{value ?? "—"}</b>
              <i>
                <i
                  style={{
                    width:
                      value === null
                        ? "0%"
                        : `${Math.max(0, Math.min(value, 100))}%`,
                  }}
                />
              </i>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export default PlayerRatings;
