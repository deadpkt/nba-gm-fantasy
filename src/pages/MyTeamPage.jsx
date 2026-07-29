import { Link, useLocation } from "react-router-dom";
import BasketballCourt from "../components/BasketballCourt";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import {
  getChemistry,
  getLineupOverall,
  getMissingLineupPositions,
  isLineupComplete,
} from "../utils/team";

function MyTeamPage() {
  const { roster, lineup, assignPlayer, record } = useLeagueTeam();
  const { activeLeague } = useLeague();
  const location = useLocation();
  const lineupReady = isLineupComplete(roster, lineup);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const chemistry = getChemistry(roster);
  const gamesAvailable = [
    LEAGUE_STATUS.REGULAR_SEASON,
    LEAGUE_STATUS.PLAYOFFS,
  ].includes(activeLeague?.status);
  const accessMessage = location.state?.leagueAccessMessage;

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
        <p>Manage the five-player roster selected through your league draft.</p>
      </section>
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
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
        {gamesAvailable ? (
          <Link
            className={`simulate-link ${!lineupReady ? "disabled" : ""}`}
            to={lineupReady ? "/games" : "/my-team"}
          >
            Go to games <span>-&gt;</span>
          </Link>
        ) : (
          <div className="simulate-link disabled">Season not started</div>
        )}
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
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Your roster is empty.</h2>
            <p>
              Complete the shared league draft to build this roster.
            </p>
          </div>
        )}
      </section>
    </PageLayout>
  );
}

export default MyTeamPage;
