import { hasVerifiedRatingsV2 } from "../../lib/playerRatingCompatibility";

const groups = [
  ["SCORING", [["Rim Scoring", "rimScoring"], ["Mid Range", "midRange"], ["Three Point", "threePoint"], ["Free Throw", "freeThrow"]]],
  ["CREATION", [["Playmaking", "playmaking"], ["Ball Handling", "ballHandling"], ["Turnover Control", "turnoverControl"]]],
  ["DEFENSE", [["Perimeter Defense", "perimeterDefense"], ["Interior Defense", "interiorDefense"], ["Steal", "steal"], ["Block", "block"]]],
  ["PHYSICAL / POSSESSION", [["Offensive Rebounding", "offensiveRebounding"], ["Defensive Rebounding", "defensiveRebounding"], ["Athleticism", "athleticism"], ["Stamina", "stamina"], ["Consistency", "consistency"]]],
];
function PlayerRatings({ player }) {
  if (!hasVerifiedRatingsV2(player)) return <section className="player-details__section"><div className="player-details__section-head"><span>GAME RATINGS</span><b>Legacy ratings profile</b></div><p className="player-stats__unavailable">Detailed verified ratings data is not yet available for this player.</p></section>;
  const source = player.ratings || {};
  return (
    <section className="player-details__section">
      <div className="player-details__section-head">
        <span>GAME RATINGS</span>
        <b>Fantasy simulation attributes</b>
      </div>
      {groups.map(([group, ratings]) => <div key={group}><div className="player-details__section-head"><span>{group}</span></div><div className="player-ratings">
        {ratings.map(([label, key]) => {
          const value = Number.isFinite(source[key]) ? source[key] : null;
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
      </div></div>)}
    </section>
  );
}
export default PlayerRatings;
