import { useState } from "react";
import { LINEUP_POSITIONS } from "../utils/team";

const formattedStat = (value) =>
  Number.isFinite(value) ? value.toFixed(1) : "—";

function threePointPercentage(stats = {}) {
  const percentage =
    stats.threePointPercentage ?? stats.threePointPercent ?? stats.threePoint;
  if (!Number.isFinite(percentage)) return "—";
  return `${percentage <= 1 ? percentage * 100 : percentage}%`;
}

function BasketballCourt({ team, lineup, onAssign }) {
  const [focusedPlayerId, setFocusedPlayerId] = useState(null);

  return (
    <section className="lineup-section">
      <div className="section-heading">
        <div>
          <p className="section-label">LINEUP BOARD</p>
          <h2>
            Starting five <span>Set your court and lock in every position</span>
          </h2>
        </div>
      </div>
      <div className="basketball-court" aria-label="Starting five court layout">
        <div className="court-marking court-marking--center-line" aria-hidden="true" />
        <div className="court-marking court-marking--center-circle" aria-hidden="true" />
        <div className="court-marking court-marking--three-arc" aria-hidden="true" />
        <div className="court-marking court-marking--paint" aria-hidden="true" />
        <div className="court-marking court-marking--free-throw" aria-hidden="true" />
        <div className="court-marking court-marking--basket" aria-hidden="true" />
        {LINEUP_POSITIONS.map((position) => {
          const player = team.find((item) => item.id === lineup[position]);
          const isFocused = focusedPlayerId === player?.id;
          const playerColor = player?.color || "#f4c646";

          return (
            <div
              className={`court-slot court-slot--${position.toLowerCase()}`}
              key={position}
            >
              <span className="court-slot__position">{position}</span>
              {player ? (
                <button
                  type="button"
                  className={`court-player ${player.overall >= 94 ? "court-player--elite" : ""} ${isFocused ? "is-focused" : ""}`}
                  style={{ "--player-color": playerColor }}
                  onClick={() =>
                    setFocusedPlayerId((current) =>
                      current === player.id ? null : player.id,
                    )
                  }
                  aria-expanded={isFocused}
                >
                  <span className="court-player__avatar">
                    <img src={player.image} alt="" />
                    <i>{player.overall}</i>
                  </span>
                  <span className="court-player__identity">
                    <b>{player.name}</b>
                    <small>{position} · {player.team}</small>
                  </span>
                  <span className="court-player__stats" aria-label={`${player.name} statistics`}>
                    <strong>{player.name}</strong>
                    <span><b>OVR</b>{player.overall}</span>
                    <span><b>PTS</b>{formattedStat(player.stats?.points)}</span>
                    <span><b>AST</b>{formattedStat(player.stats?.assists)}</span>
                    <span><b>3PT</b>{threePointPercentage(player.stats)}</span>
                  </span>
                </button>
              ) : (
                <div className="court-player court-player--empty">
                  <b>Open position</b>
                  <small>Select a player below</small>
                </div>
              )}
              <label className="sr-only" htmlFor={`lineup-${position}`}>
                Assign {position}
              </label>
              <select
                id={`lineup-${position}`}
                value={lineup[position] || ""}
                onChange={(event) =>
                  onAssign(
                    position,
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Unassigned</option>
                {team
                  .filter(
                    (item) =>
                      !Object.entries(lineup).some(
                        ([slot, id]) => slot !== position && id === item.id,
                      ),
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} ({item.overall})
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BasketballCourt;
