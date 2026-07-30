import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BasketballCourt from "../components/BasketballCourt";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import PreseasonRosterRepair from "../components/PreseasonRosterRepair";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import useLeagueContracts from "../hooks/useLeagueContracts";
import { formatMoney, getContractStatus } from "../lib/contracts";
import { releaseFreeAgent } from "../lib/freeAgency";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { getOffseasonTeamPreparationState, normalizeOffseasonPreparation } from "../lib/offseasonPreparation";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { canBuildLegalStartingFive } from "../lib/lineupFeasibility";
import {
  getChemistry,
  getLineupOverall,
  getMissingLineupPositions,
  normalizePlayerId,
} from "../utils/team";

function MyTeamPage() {
  const { user } = useAuth();
  const {
    roster,
    lineup,
    assignPlayer,
    record,
    seasonConfirmed,
    offseasonConfirmed,
    confirmSeasonLineup,
    confirmOffseasonLineup,
  } = useLeagueTeam();
  const { activeLeague, activeLeagueId, startSeason } = useLeague();
  const { teamContracts, contractsInitialized, payroll, capSpace, salaryCap, validation } = useLeagueContracts();
  const location = useLocation();
  const navigate = useNavigate();
  const [setupBusy, setSetupBusy] = useState("");
  const [setupError, setSetupError] = useState("");
  const [releaseCandidate, setReleaseCandidate] = useState(null);
  const [repairOpen, setRepairOpen] = useState(false);
  const lineupReady = isLeagueTeamSeasonReady({ roster, lineup }, activeLeague);
  const rosterConfig = normalizeRosterConfig(activeLeague);
  const starterIds = new Set(Object.values(lineup || {}).filter(Boolean).map(normalizePlayerId));
  const bench = roster.filter((player) => !starterIds.has(normalizePlayerId(player.id)));
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const chemistry = getChemistry(roster);
  const gamesAvailable = [
    LEAGUE_STATUS.REGULAR_SEASON,
    LEAGUE_STATUS.PLAYOFFS,
  ].includes(activeLeague?.status);
  const accessMessage = location.state?.leagueAccessMessage;
  const seasonSetup = activeLeague?.status === LEAGUE_STATUS.SEASON_READY;
  const offseasonSetup = activeLeague?.status === LEAGUE_STATUS.OFFSEASON;
  const preparation = normalizeOffseasonPreparation(activeLeague);
  const confirmed = offseasonSetup ? offseasonConfirmed : seasonConfirmed;
  const readyCount = offseasonSetup ? preparation.readyMemberIds.length : activeLeague?.seasonReadyMemberIds?.length || 0;
  const totalTeams = activeLeague?.memberIds?.length || 0;
  const allTeamsReady = totalTeams > 0 && readyCount === totalTeams;
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const offseasonState = getOffseasonTeamPreparationState({ league: activeLeague, team: { ownerUid: user.uid, roster, lineup }, userId: user.uid, contracts: teamContracts });
  const rosterFeasibility = canBuildLegalStartingFive(roster);
  const preseasonRepairRequired = seasonSetup && activeLeague?.season === 1 && !activeLeague?.seasonStartedAt && roster.length === rosterConfig.rosterSize && !rosterFeasibility.valid;

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

  async function confirmRelease() {
    if (!releaseCandidate) return;
    await runSetup("release", () => releaseFreeAgent({ leagueId: activeLeagueId, playerId: releaseCandidate.id }), () => setReleaseCandidate(null));
  }

  return (
    <PageLayout>
      <section className="page-hero team-setup-hero">
        <p className="section-label">{offseasonSetup ? `OFFSEASON / PREPARING FOR SEASON ${preparation.nextSeason}` : seasonSetup ? "DRAFT COMPLETE / TEAM SETUP" : "MY FRANCHISE"}</p>
        <h1>
          {seasonSetup || offseasonSetup ? "Set your " : "Your "}<span>starting five.</span>
        </h1>
        <p>{offseasonSetup ? `Your dynasty roster carries forward. Review and explicitly confirm the lineup for Season ${preparation.nextSeason}.` : seasonSetup ? `Build and confirm the unit that will represent your franchise in Season ${activeLeague.season}.` : `Manage your ${rosterConfig.rosterSize}-player roster and five-player starting lineup.`}</p>
      </section>
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
      {preseasonRepairRequired && <section className="roster-correction-panel"><div><p className="section-label">ROSTER NEEDS CORRECTION</p><h2>Your roster cannot build a legal Starting Five.</h2><p>Missing requirement: <b>{rosterFeasibility.uncoveredPositions.join(", ")}</b></p></div><button className="button-primary" type="button" onClick={() => setRepairOpen(true)}>Fix Roster</button></section>}
      {(seasonSetup || offseasonSetup) && (
        <section className={`season-setup-panel ${confirmed ? "is-confirmed" : lineupReady ? "is-complete" : "is-incomplete"}`}>
          <div className="season-ready-meter" aria-label={`${readyCount} of ${totalTeams} franchises ready`}>
            <span><b>Franchises ready</b><strong>{readyCount} / {totalTeams}</strong></span>
            <i><i style={{ width: `${totalTeams ? (readyCount / totalTeams) * 100 : 0}%` }} /></i>
          </div>
          <div>
            <p className="section-label">{offseasonSetup ? `OFFSEASON — SEASON ${preparation.nextSeason} PREPARATION` : "DRAFT COMPLETE — TEAM SETUP"}</p>
            <h2>{offseasonSetup ? `Review and confirm your Season ${preparation.nextSeason} lineup.` : "Set and confirm your starting lineup."}</h2>
            <p>{allTeamsReady ? "All franchises ready." : `Waiting for ${Math.max(0, totalTeams - readyCount)} franchise${totalTeams - readyCount === 1 ? "" : "s"}.`}</p>
          </div>
          <div>
            <button
              className={confirmed ? "button-secondary" : "button-primary"}
              type="button"
              disabled={Boolean(setupBusy) || (!confirmed && !lineupReady)}
              onClick={() => runSetup("confirm", () => offseasonSetup ? confirmOffseasonLineup(!confirmed) : confirmSeasonLineup(!confirmed))}
            >
              {setupBusy === "confirm" ? "Saving..." : confirmed ? "Confirmed / Edit Lineup" : offseasonSetup ? `Confirm for Season ${preparation.nextSeason}` : "Confirm Lineup"}
            </button>
            {seasonSetup && isCommissioner ? (
              <button
                className="button-primary"
                type="button"
                disabled={Boolean(setupBusy) || !allTeamsReady}
                onClick={() => runSetup("season", startSeason, () => navigate("/games"))}
              >
                {setupBusy === "season" ? "Starting..." : `Start Season ${activeLeague.season}`}
              </button>
            ) : seasonSetup ? (
              <small>{allTeamsReady ? `Waiting for commissioner to start Season ${activeLeague.season}.` : "Waiting for every franchise to confirm its lineup."}</small>
            ) : <small>No next-season start is available yet. Every franchise must prepare independently.</small>}
          </div>
          <p className="lineup-confirmation-message">
            {confirmed
              ? `LINEUP CONFIRMED — Your franchise is ready for Season ${offseasonSetup ? preparation.nextSeason : activeLeague.season}.`
              : lineupReady
                ? "Starting five complete. Confirm your lineup to continue."
                : "Assign all five positions to continue."}
          </p>
          {confirmed && <p className="season-setup-panel__confirmed">Editing any assignment will remove confirmation.</p>}
          {offseasonSetup && <p className="season-setup-panel__confirmed">Roster: {offseasonState.requirements.rosterValid ? "READY" : "NOT READY"} · Lineup: {offseasonState.requirements.lineupValid ? "READY" : "NOT READY"} · Contracts: {offseasonState.requirements.contractsInitialized ? "READY" : "LEGACY / INITIALIZE"} · Cap: {offseasonState.requirements.capValid ? `${formatMoney(offseasonState.payroll)} / ${formatMoney(salaryCap)}` : "INVALID"} · Confirmation: {offseasonState.requirements.ownerConfirmed ? "READY" : "PENDING"}</p>}
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
      <section className={`team-contract-summary ${capSpace < 0 ? "is-over-cap" : ""}`}>
        <div><span>TEAM PAYROLL</span><b>{contractsInitialized ? formatMoney(payroll) : "NOT INITIALIZED"}</b><small>{contractsInitialized ? `${teamContracts.length} contracts` : "Open Contracts for league initialization"}</small></div>
        <div><span>SALARY CAP</span><b>{formatMoney(salaryCap)}</b><small>League hard cap</small></div>
        <div><span>{capSpace < 0 ? "OVER CAP BY" : "CAP SPACE"}</span><b>{contractsInitialized ? formatMoney(Math.abs(capSpace)) : "—"}</b><small>{contractsInitialized ? validation.valid ? "FINANCIAL STATUS READY" : "CONTRACT REVIEW REQUIRED" : "AWAITING CONTRACTS"}</small></div>
        <Link className="button-secondary" to="/contracts">View Contracts</Link>
      </section>
      <BasketballCourt
        team={roster}
        lineup={lineup}
        onAssign={(position, playerId) =>
          save(() => assignPlayer(position, playerId))
        }
      />
      {rosterConfig.benchSize > 0 && (
        <section className="bench-section">
          <div className="section-heading"><div><p className="section-label">SECOND UNIT</p><h2>Bench <span>{bench.length}/{rosterConfig.benchSize} players</span></h2></div></div>
          <div className="bench-grid">
            {bench.map((player) => {
              const contract = teamContracts.find((item) => normalizePlayerId(item.playerId) === normalizePlayerId(player.id));
              return <article className="bench-player" key={player.id}><PlayerCard player={player} /><div><span>{player.primaryPosition || player.position} · OVR {player.overall}</span><b>{contract ? `${formatMoney(contract.salary)} / YEAR` : "CONTRACT PENDING"}</b></div></article>;
            })}
            {!bench.length && <p className="empty-state">Assign five starters to reveal your bench unit.</p>}
          </div>
        </section>
      )}
      <section className="players-section">
        <div className="section-heading">
          <div>
            <p className="section-label">YOUR ROSTER</p>
            <h2>
              Selected players <span>{roster.length}/{rosterConfig.rosterSize} players</span>
            </h2>
          </div>
        </div>
        {roster.length ? (
          <div className="players-grid">
            {roster.map((player) => {
              const contract = teamContracts.find((item) => String(item.playerId) === String(player.id));
              const status = getContractStatus(contract);
              return <div className="roster-contract-card" key={player.id}><PlayerCard player={player} /><div><b>{formatMoney(contract?.salary)} / YEAR</b><span className={`contract-status contract-status--${status?.toLowerCase() || "missing"}`}>{status ? status.replace("_", "-") : "NOT INITIALIZED"}</span><small>{contract ? `${contract.yearsRemaining} year${contract.yearsRemaining === 1 ? "" : "s"} remaining` : "Open Contracts to initialize"}</small>{offseasonSetup && contract && <button className="button-secondary roster-release-button" type="button" disabled={Boolean(setupBusy)} onClick={() => setReleaseCandidate(player)}>Release</button>}</div></div>;
            })}
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
      {releaseCandidate && <div className="player-details-backdrop" role="presentation"><section className="release-confirmation" role="dialog" aria-modal="true" aria-labelledby="release-title"><p className="section-label">ROSTER TRANSACTION</p><h2 id="release-title">Release Player?</h2><p><b>{releaseCandidate.name}</b> will become a free agent and their contract will be terminated immediately.</p><div><button className="button-secondary" type="button" disabled={setupBusy === "release"} onClick={() => setReleaseCandidate(null)}>Cancel</button><button className="button-primary" type="button" disabled={setupBusy === "release"} onClick={confirmRelease}>{setupBusy === "release" ? "Releasing..." : "Release Player"}</button></div></section></div>}
      {repairOpen && <PreseasonRosterRepair roster={roster} onClose={() => setRepairOpen(false)} />}
    </PageLayout>
  );
}

export default MyTeamPage;
