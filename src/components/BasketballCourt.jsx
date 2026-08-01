import { useState } from "react";
import {
  findRosterPlayer,
  getAssignableLineupPlayers,
  LINEUP_POSITIONS,
} from "../utils/team";
import { openPlayerDetails } from "./player/PlayerDetailsModal";

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
  const teamColor = team.find((player) => player.color)?.color || "#e32842";

  return (
    <section className="lineup-section">
      <div className="section-heading">
        <div>
          <p className="section-label">LINEUP BOARD</p>
          <h2>
            Starting five <span>Build your game-night unit</span>
          </h2>
        </div>
        <div className="lineup-section__status" aria-label="Lineup status">
          <span>ACTIVE UNIT</span>
          <b>
            {Object.values(lineup).filter(Boolean).length}
            <i>/5</i>
          </b>
        </div>
      </div>
      <div className="lineup-command" style={{ "--court-accent": teamColor }}>
        <div
          className="basketball-court"
          aria-label="Starting five court layout"
        >
          <div className="court-floor-glow" aria-hidden="true" />
          <div className="court-center-logo" aria-hidden="true">
            <span>FC</span>
            <small>FRANCHISE</small>
          </div>
          <div
            className="court-marking court-marking--center-line"
            aria-hidden="true"
          />
          <div
            className="court-marking court-marking--center-circle"
            aria-hidden="true"
          />
          <div
            className="court-marking court-marking--three-arc"
            aria-hidden="true"
          />
          <div
            className="court-marking court-marking--paint"
            aria-hidden="true"
          />
          <div
            className="court-marking court-marking--free-throw"
            aria-hidden="true"
          />
          <div
            className="court-marking court-marking--basket"
            aria-hidden="true"
          />
          {LINEUP_POSITIONS.map((position) => {
            const player = findRosterPlayer(team, lineup[position]);
            const isFocused = focusedPlayerId === player?.id;
            const playerColor = player?.color || teamColor;

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
                    onClick={() => {
                      setFocusedPlayerId((current) =>
                        current === player.id ? null : player.id,
                      );
                      openPlayerDetails(player);
                    }}
                    aria-expanded={isFocused}
                  >
                    <span className="court-player__avatar">
                      <img src={player.image} alt="" />
                    </span>
                    <span className="court-player__identity">
                      <b>{player.name}</b>
                      <small>
                        {position} · {player.team}
                      </small>
                    </span>
                    <span
                      className="court-player__ovr"
                      aria-label={`${player.overall} overall`}
                    >
                      <b>{player.overall}</b>
                      <small>OVR</small>
                    </span>
                    <span
                      className="court-player__stats"
                      aria-label={`${player.name} statistics`}
                    >
                      <strong>{player.name}</strong>
                      <span>
                        <b>OVR</b>
                        {player.overall}
                      </span>
                      <span>
                        <b>PTS</b>
                        {formattedStat(player.stats?.points)}
                      </span>
                      <span>
                        <b>REB</b>
                        {formattedStat(player.stats?.rebounds)}
                      </span>
                      <span>
                        <b>AST</b>
                        {formattedStat(player.stats?.assists)}
                      </span>
                      <span>
                        <b>3PT</b>
                        {threePointPercentage(player.stats)}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="court-player court-player--empty">
                    <b>Open position</b>
                    <small>Add a starter</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside
          className="lineup-command__rail"
          aria-label="Starting five assignments"
        >
          <div className="lineup-command__rail-head">
            <span>LINEUP COMMAND</span>
            <b>SELECT A STARTER</b>
          </div>
          {LINEUP_POSITIONS.map((position) => {
            const player = findRosterPlayer(team, lineup[position]);
            return (
              <label
                className="lineup-control"
                key={position}
                htmlFor={`lineup-${position}`}
              >
                <span className="lineup-control__slot">{position}</span>
                <span className="lineup-control__copy">
                  <b>{player?.name || "Open slot"}</b>
                  <small>
                    {player
                      ? `${player.overall} OVR · ${player.team}`
                      : "Choose from your roster"}
                  </small>
                </span>
                <select
                  id={`lineup-${position}`}
                  value={lineup[position] || ""}
                  onChange={(event) =>
                    onAssign(position, event.target.value || null)
                  }
                >
                  <option value="">Unassigned</option>
                  {getAssignableLineupPlayers(team, lineup, position).map(
                    (item) => (
                      <option value={item.id} key={item.id}>
                        {item.name} ({item.overall})
                      </option>
                    ),
                  )}
                </select>
              </label>
            );
          })}
          <p className="lineup-command__hint">
            Select a card on court to inspect player attributes.
          </p>
        </aside>
      </div>
    </section>
  );
}

export default BasketballCourt;
