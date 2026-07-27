import { Link } from "react-router-dom";
import BasketballCourt from "../components/BasketballCourt";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import PlayerDatabase from "../components/PlayerDatabase";
import useLeagueTeam from "../hooks/useLeagueTeam";
import {
  getChemistry,
  getLineupOverall,
  getMissingLineupPositions,
  isLineupComplete,
} from "../utils/team";

function MyTeamPage() {
  const { roster, lineup, addPlayer, assignPlayer, removePlayer, record } =
    useLeagueTeam();
  const lineupReady = isLineupComplete(roster, lineup);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const chemistry = getChemistry(roster);

  function save(action) {
    void action().catch((error) =>
      console.error("Could not save league franchise:", error),
    );
  }

  return (
    <PageLayout>
      <section className="page-hero">
        <p className="section-label">MY FRANCHISE</p>
        <h1>
          Your <span>starting five.</span>
        </h1>
        <p>Choose your five players, then place each one on the court.</p>
      </section>
      <section className="team-dashboard">
        <div className="team-score">
          <span>LINEUP OVR</span>
          <b>{overall || "-"}</b>
          <small>
            {lineupReady
              ? "Active starting five"
              : `Missing: ${missingPositions.join(", ")}`}
          </small>
        </div>
        <div className="team-score">
          <span>CHEMISTRY</span>
          <b>
            {chemistry || "-"}
            <i>%</i>
          </b>
          <small>Position & team balance</small>
        </div>
        <div className="team-score">
          <span>SEASON RECORD</span>
          <b>
            {record.wins}
            <i>-{record.losses}</i>
          </b>
          <small>League matches</small>
        </div>
        <Link
          className={`simulate-link ${!lineupReady ? "disabled" : ""}`}
          to={lineupReady ? "/games" : "/my-team"}
        >
          Go to games <span>-&gt;</span>
        </Link>
      </section>
      <BasketballCourt
        team={roster}
        lineup={lineup}
        onAssign={(position, playerId) =>
          save(() => assignPlayer(position, playerId))
        }
      />
      <section className="players-section">
        <div className="section-heading">
          <div>
            <p className="section-label">YOUR ROSTER</p>
            <h2>
              Selected players <span>{roster.length}/5 players</span>
            </h2>
          </div>
        </div>
        {roster.length ? (
          <div className="players-grid">
            {roster.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                actionLabel="Remove"
                onAction={() => save(() => removePlayer(player.id))}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Your roster is empty.</h2>
            <p>
              Add five players from the database below to unlock the court lineup.
            </p>
          </div>
        )}
      </section>
      <PlayerDatabase
        roster={roster}
        onAddPlayer={(player) => save(() => addPlayer(player))}
      />
    </PageLayout>
  );
}

export default MyTeamPage;
