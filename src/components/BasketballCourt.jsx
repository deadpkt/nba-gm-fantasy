import { useEffect, useMemo, useRef, useState } from "react";
import PlayerImage from "./player/PlayerImage";
import {
  findRosterPlayer,
  getAssignableLineupPlayers,
  LINEUP_POSITIONS,
} from "../utils/team";

function PositionMap() {
  return (
    <svg className="position-map__geometry" viewBox="0 0 600 650" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none">
        <rect x="2" y="2" width="596" height="646" rx="12" />
        <path d="M 190 650 V 475 H 410 V 650 M 190 475 H 410" />
        <circle cx="300" cy="475" r="66" />
        <path d="M 48 650 V 565 C 48 300 145 150 300 150 C 455 150 552 300 552 565 V 650" />
        <path d="M 260 606 H 340" />
        <circle cx="300" cy="585" r="14" />
      </g>
    </svg>
  );
}

function BasketballCourt({ team, lineup, onAssign, benchContent }) {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [highlightedPosition, setHighlightedPosition] = useState(null);
  const closeButtonRef = useRef(null);
  const eligiblePlayers = useMemo(
    () => selectedPosition ? getAssignableLineupPlayers(team, lineup, selectedPosition) : [],
    [lineup, selectedPosition, team],
  );
  const selectedPlayer = selectedPosition ? findRosterPlayer(team, lineup?.[selectedPosition]) : null;
  const assignedCount = LINEUP_POSITIONS.filter((position) => lineup?.[position]).length;

  useEffect(() => {
    if (!selectedPosition) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedPosition(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedPosition]);

  function selectPlayer(playerId) {
    onAssign(selectedPosition, playerId);
    setSelectedPosition(null);
  }

  function positionInteractionProps(position) {
    return {
      onMouseEnter: () => setHighlightedPosition(position),
      onMouseLeave: () => setHighlightedPosition(null),
      onFocus: () => setHighlightedPosition(position),
      onBlur: () => setHighlightedPosition(null),
    };
  }

  return (
    <section className="lineup-workspace">
      <aside className="position-map-panel">
        <div className="position-map-panel__heading"><p className="section-label">FORMATION</p><b>{assignedCount} / 5</b></div>
        <div className="position-map" aria-label="Starting five position map">
          <PositionMap />
          {LINEUP_POSITIONS.map((position) => {
            const player = findRosterPlayer(team, lineup?.[position]);
            return (
              <button
                type="button"
                className={`position-map__marker position-map__marker--${position.toLowerCase()}${highlightedPosition === position ? " is-highlighted" : ""}${player ? " is-filled" : ""}`}
                onClick={() => setSelectedPosition(position)}
                aria-label={player ? `Change ${position}, currently ${player.name}` : `Add player to ${position}`}
                key={position}
                {...positionInteractionProps(position)}
              >
                <b>{position}</b><i aria-hidden="true">{player ? "" : "+"}</i>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="roster-lineup-panel">
        <div className="roster-lineup-panel__heading"><div><p className="section-label">STARTING FIVE</p><h2>Active lineup</h2></div><b>{assignedCount} / 5</b></div>
        <div className="starting-five-list">
          {LINEUP_POSITIONS.map((position) => {
            const player = findRosterPlayer(team, lineup?.[position]);
            return (
              <button
                type="button"
                className={`starting-five-row${highlightedPosition === position ? " is-highlighted" : ""}${player ? "" : " is-empty"}`}
                onClick={() => setSelectedPosition(position)}
                aria-label={player ? `Change ${position}, currently ${player.name}` : `Add player to ${position}`}
                title={player?.name || `Add ${position}`}
                key={position}
                {...positionInteractionProps(position)}
              >
                <span className="starting-five-row__position">{position}</span>
                <span className="starting-five-row__avatar">{player ? <PlayerImage player={player} alt="" /> : <i aria-hidden="true">+</i>}</span>
                <span className="starting-five-row__identity"><b>{player?.name || "Open position"}</b><small>{player ? player.team || player.primaryPosition || player.position : "Select an eligible player"}</small></span>
                <strong>{player?.overall ?? "—"}<small> OVR</small></strong>
              </button>
            );
          })}
        </div>
        {benchContent}
      </div>

      {selectedPosition && (
        <div className="lineup-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPosition(null); }}>
          <section className="lineup-picker" role="dialog" aria-modal="true" aria-labelledby="lineup-picker-title">
            <header><div><p className="section-label">{selectedPosition} POSITION</p><h2 id="lineup-picker-title">Choose a starter</h2></div><button ref={closeButtonRef} className="lineup-picker__close" type="button" onClick={() => setSelectedPosition(null)} aria-label="Close lineup picker">×</button></header>
            <div className="lineup-picker__options">
              {selectedPlayer && <button type="button" className="lineup-picker__clear" onClick={() => selectPlayer(null)}>Clear {selectedPosition} position</button>}
              {eligiblePlayers.map((player) => {
                const isCurrent = player.id === selectedPlayer?.id;
                const positions = player.eligiblePositions?.length ? player.eligiblePositions.join(" / ") : player.primaryPosition || player.position;
                return <button type="button" className={`lineup-picker__player${isCurrent ? " is-current" : ""}`} onClick={() => selectPlayer(player.id)} key={player.id}><PlayerImage player={player} alt="" /><span><b>{player.name}</b><small>{positions || "Player"} · {player.overall ?? "—"} OVR</small></span>{isCurrent && <em>CURRENT</em>}</button>;
              })}
              {!eligiblePlayers.length && <p className="lineup-picker__empty">No eligible roster players are available.</p>}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default BasketballCourt;
