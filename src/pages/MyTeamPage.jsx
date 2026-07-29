import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BasketballCourt from "../components/BasketballCourt";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import {
  getChemistry,
  getLineupOverall,
  getMissingLineupPositions,
} from "../utils/team";

function MyTeamPage() {
  const { user } = useAuth();
  const {
    roster,
    lineup,
    assignPlayer,
    record,
    seasonConfirmed,
    confirmSeasonLineup,
  } = useLeagueTeam();
  const { activeLeague, startSeason } = useLeague();
  const location = useLocation();
  const navigate = useNavigate();
  const [setupBusy, setSetupBusy] = useState("");
  const [setupError, setSetupError] = useState("");
  const lineupReady = isLeagueTeamSeasonReady({ roster, lineup });
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const chemistry = getChemistry(roster);
  const gamesAvailable = [
    LEAGUE_STATUS.REGULAR_SEASON,
    LEAGUE_STATUS.PLAYOFFS,
  ].includes(activeLeague?.status);
  const accessMessage = location.state?.leagueAccessMessage;
  const seasonSetup = activeLeague?.status === LEAGUE_STATUS.SEASON_READY;
  const readyCount = activeLeague?.seasonReadyMemberIds?.length || 0;
  const totalTeams = activeLeague?.memberIds?.length || 0;
  const allTeamsReady = totalTeams > 0 && readyCount === totalTeams;
  const isCommissioner = activeLeague?.commissionerUid === user.uid;

  function save(action) {
    void action().catch((error) =>
      console.error("Could not save league franchise:", error),
    );
  }

  async function runSetup(actionName, action, onSuccess) {
    setSetupError("");
    setSetupBusy(actionName);
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      setSetupError(error.message || "Season setup could not be updated.");
    } finally {
      setSetupBusy("");
    }
  }

  return (
    <PageLayout>
      <section className="page-hero team-setup-hero">
        <p className="section-label">{seasonSetup ? "DRAFT COMPLETE / TEAM SETUP" : "MY FRANCHISE"}</p>
        <h1>
          {seasonSetup ? "Set your " : "Your "}<span>starting five.</span>
        </h1>
        <p>{seasonSetup ? `Build and confirm the unit that will represent your franchise in Season ${activeLeague.season}.` : "Manage the five-player roster selected through your league draft."}</p>
      </section>
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
      {seasonSetup && (
        <section className={`season-setup-panel ${seasonConfirmed ? "is-confirmed" : lineupReady ? "is-complete" : "is-incomplete"}`}>
          <div className="season-ready-meter" aria-label={`${readyCount} of ${totalTeams} franchises ready`}>
            <span><b>Franchises ready</b><strong>{readyCount} / {totalTeams}</strong></span>
            <i><i style={{ width: `${totalTeams ? (readyCount / totalTeams) * 100 : 0}%` }} /></i>
          </div>
          <div>
            <p className="section-label">DRAFT COMPLETE — TEAM SETUP</p>
            <h2>Set and confirm your starting lineup.</h2>
            <p>{allTeamsReady ? "All franchises ready." : `Waiting for ${Math.max(0, totalTeams - readyCount)} franchise${totalTeams - readyCount === 1 ? "" : "s"}.`}</p>
          </div>
          <div>
            <button
              className={seasonConfirmed ? "button-secondary" : "button-primary"}
              type="button"
              disabled={Boolean(setupBusy) || (!seasonConfirmed && !lineupReady)}
              onClick={() => runSetup("confirm", () => confirmSeasonLineup(!seasonConfirmed))}
            >
              {setupBusy === "confirm" ? "Saving..." : seasonConfirmed ? "Lineup Confirmed / Edit" : "Confirm Lineup"}
            </button>
            {isCommissioner ? (
              <button
                className="button-primary"
                type="button"
                disabled={Boolean(setupBusy) || !allTeamsReady}
                onClick={() => runSetup("season", startSeason, () => navigate("/games"))}
              >
                {setupBusy === "season" ? "Starting..." : `Start Season ${activeLeague.season}`}
              </button>
            ) : (
              <small>{allTeamsReady ? `Waiting for commissioner to start Season ${activeLeague.season}.` : "Waiting for every franchise to confirm its lineup."}</small>
            )}
          </div>
          <p className="lineup-confirmation-message">
            {seasonConfirmed
              ? `LINEUP CONFIRMED — Your franchise is ready for Season ${activeLeague.season}.`
              : lineupReady
                ? "Starting five complete. Confirm your lineup to continue."
                : "Assign all five positions to continue."}
          </p>
          {seasonConfirmed && <p className="season-setup-panel__confirmed">Editing any assignment will remove confirmation.</p>}
          {setupError && <p className="official-game-error" role="alert">{setupError}</p>}
        </section>
      )}
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
