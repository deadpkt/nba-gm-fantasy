import { useState } from "react";
import usePlayers from "../hooks/usePlayers";
import usePlayerSearch from "../hooks/usePlayerSearch";
import PlayerCard from "./PlayerCard";

const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];

function PlayerDatabase({ roster, onAddPlayer }) {
  const {
    players,
    playersLoading,
    playersError,
    fallbackUsed,
    catalogEmpty,
    catalogError,
    validationDiagnostics,
  } = usePlayers();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const filteredPlayers = usePlayerSearch(players, search, position);
  const invalidFirestorePlayers = validationDiagnostics?.firestore?.invalid.length || 0;

  return (
    <section className="players-section player-database">
      <div className="section-heading">
        <div>
          <p className="section-label">BUILD TEAM</p>
          <h2>
            Player database <span>{filteredPlayers.length} available</span>
          </h2>
        </div>
      </div>
      <div className="player-database__controls">
        <label className="player-search">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search player, team, or position"
          />
        </label>
        <div className="position-filters" aria-label="Filter players by position">
          {positions.map((item) => (
            <button
              type="button"
              className={position === item ? "is-active" : ""}
              key={item}
              onClick={() => setPosition(item)}
            >
              {item === "ALL" ? "All" : item}
            </button>
          ))}
        </div>
      </div>
      {fallbackUsed && (
        <div className="player-database__empty">
          {catalogError?.code === "catalog-empty"
            ? "Firestore catalog is empty. Using the local player catalog."
            : "Firestore catalog unavailable. Using the local player catalog."}
        </div>
      )}
      {invalidFirestorePlayers > 0 && (
        <div className="player-database__empty">
          {invalidFirestorePlayers} invalid catalog player{invalidFirestorePlayers === 1 ? " was" : "s were"} skipped safely.
        </div>
      )}
      {playersLoading ? (
        <div className="player-database__empty">Loading player catalog...</div>
      ) : catalogEmpty || playersError ? (
        <div className="player-database__empty">
          Player catalog is unavailable. Please try again later.
        </div>
      ) : filteredPlayers.length ? (
        <div className="players-grid">
          {filteredPlayers.map((player) => {
            const onRoster = roster.some((member) => member.id === player.id);
            const rosterFull = roster.length >= 5;
            return (
              <PlayerCard
                key={player.id}
                player={player}
                onAction={onAddPlayer}
                disabled={onRoster || rosterFull}
                actionLabel={
                  onRoster
                    ? "On roster"
                    : rosterFull
                      ? "Roster full"
                      : "Add player"
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="player-database__empty">
          No players match this search.
        </div>
      )}
    </section>
  );
}

export default PlayerDatabase;
