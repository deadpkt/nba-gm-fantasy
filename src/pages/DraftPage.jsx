import { useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";
import usePlayerSearch from "../hooks/usePlayerSearch";

function DraftPage() {
  const [position, setPosition] = useState("ALL");
  const [search, setSearch] = useState("");
  const { roster, addPlayer } = useLeagueTeam();
  const {
    players,
    playersLoading,
    playersError,
    fallbackUsed,
    catalogEmpty,
    catalogError,
  } = usePlayers();
  const filteredPlayers = usePlayerSearch(players, search, position);

  return (
    <PageLayout>
      <section className="hero-section">
        <p className="section-label">LEAGUE DRAFT ROOM</p>
        <h1>
          Build your <span>starting five.</span>
        </h1>
        <p className="hero-copy">
          Select elite talent for your franchise, then assign each player on
          the court from My Team.
        </p>
        <div className="hero-score">
          <span>DRAFT BOARD OPEN</span>
          <b>{roster.length}/5 PLAYERS SELECTED</b>
          <span>{5 - roster.length} PICKS REMAINING</span>
        </div>
      </section>
      <section className="draft-toolbar">
        <Link to="/league">&lt;- Back to League HQ</Link>
        <Link to="/my-team">Review My Team -&gt;</Link>
      </section>
      <section className="players-section">
        <div className="section-heading">
          <div>
            <p className="section-label">AVAILABLE PLAYERS</p>
            <h2>
              Draft board{" "}
              <span>
                {playersLoading ? "Loading..." : `${filteredPlayers.length} players`}
              </span>
            </h2>
          </div>
          <select
            className="filter-button"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          >
            <option value="ALL">All positions</option>
            {['PG', 'SG', 'SF', 'PF', 'C'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <label className="player-search">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search player, team, or position"
          />
        </label>
        {fallbackUsed && (
          <div className="player-database__empty">
            {catalogError?.code === "catalog-empty"
              ? "Firestore catalog is empty. Using the local player catalog."
              : "Firestore catalog unavailable. Using the local player catalog."}
          </div>
        )}
        {catalogEmpty || playersError ? (
          <div className="player-database__empty">
            Player catalog is unavailable. Please try again later.
          </div>
        ) : playersLoading ? (
          <div className="player-database__empty">Loading player catalog...</div>
        ) : filteredPlayers.length ? (
          <div className="players-grid">
            {filteredPlayers.map((player) => {
              const drafted = roster.some((member) => member.id === player.id);
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onAction={(nextPlayer) => {
                    void addPlayer(nextPlayer).catch((error) =>
                      console.error("Could not draft player:", error),
                    );
                  }}
                  disabled={drafted || roster.length === 5}
                  actionLabel={drafted ? "Drafted" : "Draft player"}
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
    </PageLayout>
  );
}

export default DraftPage;
