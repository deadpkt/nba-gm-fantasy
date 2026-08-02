import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BasketballCourt from "../components/BasketballCourt";
import PageLayout from "../components/PageLayout";
import PreseasonRosterRepair from "../components/PreseasonRosterRepair";
import RosterPlayerChip from "../components/RosterPlayerChip";
import TeamIdentitySummary from "../components/team/TeamIdentitySummary";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import useLeagueContracts from "../hooks/useLeagueContracts";
import { formatMoney } from "../lib/contracts";
import { getUserFriendlyError, reportClientError } from "../lib/clientErrors";
import { releaseFreeAgent } from "../lib/freeAgency";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { normalizeOffseasonPreparation } from "../lib/offseasonPreparation";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { canBuildLegalStartingFive } from "../lib/lineupFeasibility";
import { deriveTeamProfile, STARTING_POSITIONS } from "../lib/teamIdentity";
import {
  getMissingLineupPositions,
  normalizePlayerId,
} from "../utils/team";
import "../myTeam.css";

function MyTeamPage() {
  const { user } = useAuth();
  const {
    roster,
    lineup,
    assignPlayer,
    seasonConfirmed,
    offseasonConfirmed,
    leagueTeam,
    leagueTeamLoading,
    confirmSeasonLineup,
    confirmOffseasonLineup,
  } = useLeagueTeam();
  const { activeLeague, activeLeagueId, startSeason } = useLeague();
  const offseasonSetup = activeLeague?.status === LEAGUE_STATUS.OFFSEASON;
  const { teamContracts, contractsInitialized, payroll, capSpace, salaryCap } = useLeagueContracts({ enabled: offseasonSetup });
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
  const teamIdentity = useMemo(() => {
    const rosterById = new Map(roster.map((player) => [normalizePlayerId(player.id), player]));
    const normalizedLineup = Object.fromEntries(STARTING_POSITIONS.map((position) => [position, rosterById.get(normalizePlayerId(lineup?.[position])) || null]));
    return deriveTeamProfile(normalizedLineup);
  }, [lineup, roster]);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const gamesAvailable = [
    LEAGUE_STATUS.REGULAR_SEASON,
    LEAGUE_STATUS.PLAYOFFS,
  ].includes(activeLeague?.status);
  const accessMessage = location.state?.leagueAccessMessage;
  const seasonSetup = activeLeague?.status === LEAGUE_STATUS.SEASON_READY;
  const preparation = normalizeOffseasonPreparation(activeLeague);
  const confirmed = offseasonSetup ? offseasonConfirmed : seasonConfirmed;
  const readyCount = offseasonSetup ? preparation.readyMemberIds.length : activeLeague?.seasonReadyMemberIds?.length || 0;
  const totalTeams = activeLeague?.memberIds?.length || 0;
  const allTeamsReady = totalTeams > 0 && readyCount === totalTeams;
  const isCommissioner = activeLeague?.commissionerUid === user.uid;
  const rosterFeasibility = canBuildLegalStartingFive(roster);
  const preseasonRepairRequired = seasonSetup && activeLeague?.season === 1 && !activeLeague?.seasonStartedAt && roster.length === rosterConfig.rosterSize && !rosterFeasibility.valid;
  const rosterUnderfilled = roster.length < rosterConfig.rosterSize;
  const lineupStatus = preseasonRepairRequired
    ? "LINEUP NEEDS CORRECTION"
    : rosterUnderfilled
      ? `ROSTER ${roster.length} / ${rosterConfig.rosterSize}`
      : missingPositions.length
        ? `NEEDS A ${missingPositions[0]}`
        : confirmed
          ? "LINEUP CONFIRMED"
          : lineupReady
            ? "LINEUP READY"
            : "LINEUP NEEDS REVIEW";

  const primaryAction = preseasonRepairRequired
    ? { label: "Fix Lineup", action: () => setRepairOpen(true) }
    : offseasonSetup && rosterUnderfilled
      ? { label: "Go to Free Agency", action: () => navigate("/free-agency") }
      : seasonSetup && isCommissioner && confirmed && allTeamsReady
        ? { label: `Start Season ${activeLeague.season}`, busy: "season", action: () => runSetup("season", startSeason, () => navigate("/games")) }
        : seasonSetup || offseasonSetup
          ? {
              label: confirmed ? "Update Lineup" : offseasonSetup ? `Confirm for Season ${preparation.nextSeason}` : "Confirm Lineup",
              busy: "confirm",
              disabled: !confirmed && !lineupReady,
              action: () => runSetup("confirm", () => offseasonSetup ? confirmOffseasonLineup(!confirmed) : confirmSeasonLineup(!confirmed)),
            }
          : gamesAvailable
            ? { label: "Go to Games", disabled: !lineupReady, action: () => navigate("/games") }
            : null;

  function save(action) {
    void action().catch((error) => reportClientError("Franchise", error));
  }

  async function runSetup(actionName, action, onSuccess) {
    setSetupError("");
    setSetupBusy(actionName);
    try {
      await action();
      onSuccess?.();
    } catch (error) {
      setSetupError(getUserFriendlyError(error, "Season setup could not be updated."));
    } finally {
      setSetupBusy("");
    }
  }

  async function confirmRelease() {
    if (!releaseCandidate) return;
    await runSetup("release", () => releaseFreeAgent({ leagueId: activeLeagueId, playerId: releaseCandidate.id }), () => setReleaseCandidate(null));
  }

  function renderBench() {
    if (rosterConfig.benchSize <= 0) return null;
    return (
      <section className="bench-section">
        <div className="section-heading section-row-heading"><div><p className="section-label">BENCH</p><h2>Rotation</h2></div><b>{bench.length} / {rosterConfig.benchSize}</b></div>
        <div className="bench-grid">
          {bench.map((player, index) => {
            const hasContract = teamContracts.some((item) => String(item.playerId) === String(player.id));
            return <article className="bench-player" key={player.id}><RosterPlayerChip player={player} rotationLabel={`B${index + 1}`} />{offseasonSetup && <button className="bench-release-button" type="button" disabled={Boolean(setupBusy) || !hasContract} onClick={() => setReleaseCandidate(player)}>Release</button>}</article>;
          })}
          {Array.from({ length: Math.max(0, rosterConfig.benchSize - bench.length) }).map((_, index) => <div className="bench-open-slot" key={`bench-open-${index}`}><span>B{bench.length + index + 1}</span><div><b>Open roster spot</b>{offseasonSetup ? <Link to="/free-agency">Go to Free Agency</Link> : <small>Complete your roster</small>}</div></div>)}
        </div>
      </section>
    );
  }

  if (leagueTeamLoading) {
    return (
      <PageLayout>
        <div className="my-team-page my-team-skeleton" aria-label="Loading franchise lineup" aria-busy="true">
          <div className="my-team-skeleton__header"><i /><i /></div>
          <div className="my-team-skeleton__court">
            {Array.from({ length: 5 }).map((_, index) => <i key={index} />)}
          </div>
          <div className="my-team-skeleton__bench">{Array.from({ length: 3 }).map((_, index) => <i key={index} />)}</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="my-team-page">
      <section className="franchise-team-header">
        <div className="franchise-team-header__identity">
          <p className="section-label">MY FRANCHISE</p>
          <h1>{leagueTeam?.name || `${user.displayName || "GM"}'s Team`}</h1>
          <p>Season {activeLeague?.season} <i aria-hidden="true">·</i> {getLeagueStatusLabel(activeLeague?.status)}</p>
        </div>
        <div className="franchise-team-header__command">
          <span className={`lineup-state${confirmed ? " is-confirmed" : ""}`}>
            {confirmed && <i aria-hidden="true">✓</i>}{lineupStatus}
          </span>
          {primaryAction && (
            <button
              className="button-primary"
              type="button"
              disabled={Boolean(setupBusy) || primaryAction.disabled}
              onClick={primaryAction.action}
            >
              {setupBusy === primaryAction.busy ? "Saving..." : primaryAction.label}
            </button>
          )}
        </div>
      </section>
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
      {preseasonRepairRequired && <p className="my-team-inline-alert" role="alert">Missing legal coverage: <b>{rosterFeasibility.uncoveredPositions.join(", ")}</b></p>}
      {(seasonSetup || offseasonSetup) && confirmed && !allTeamsReady && <p className="my-team-readiness" role="status">League readiness: {readyCount} / {totalTeams}</p>}
      {setupError && <p className="official-game-error my-team-error" role="alert">{setupError}</p>}
      {offseasonSetup && (
        <section className={`team-finance-line ${capSpace < 0 ? "is-over-cap" : ""}`} aria-label="Team finances">
          <p><span>Payroll</span><b>{contractsInitialized ? `${formatMoney(payroll)} / ${formatMoney(salaryCap)}` : "Not initialized"}</b></p>
          <i aria-hidden="true" />
          <p><span>{capSpace < 0 ? "Over cap" : "Cap space"}</span><b>{contractsInitialized ? formatMoney(Math.abs(capSpace)) : "—"}</b></p>
          <Link to="/contracts">View Contracts <span aria-hidden="true">→</span></Link>
        </section>
      )}
      <BasketballCourt
        team={roster}
        lineup={lineup}
        benchContent={renderBench()}
        onAssign={(position, playerId) =>
          save(() => assignPlayer(position, playerId))
        }
      />
      <TeamIdentitySummary profile={teamIdentity} />
      {releaseCandidate && <div className="player-details-backdrop" role="presentation"><section className="release-confirmation" role="dialog" aria-modal="true" aria-labelledby="release-title"><p className="section-label">ROSTER TRANSACTION</p><h2 id="release-title">Release Player?</h2><p><b>{releaseCandidate.name}</b> will become a free agent and their contract will be terminated immediately.</p><div><button className="button-secondary" type="button" disabled={setupBusy === "release"} onClick={() => setReleaseCandidate(null)}>Cancel</button><button className="button-primary" type="button" disabled={setupBusy === "release"} onClick={confirmRelease}>{setupBusy === "release" ? "Releasing..." : "Release Player"}</button></div></section></div>}
      {repairOpen && <PreseasonRosterRepair roster={roster} onClose={() => setRepairOpen(false)} />}
      </div>
    </PageLayout>
  );
}

export default MyTeamPage;
