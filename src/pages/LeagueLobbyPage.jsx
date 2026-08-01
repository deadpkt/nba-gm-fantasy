import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import LeagueProgress from "../components/LeagueProgress";
import LeagueActivityFeed from "../components/activity/LeagueActivityFeed";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueContracts from "../hooks/useLeagueContracts";
import useLeagueActivity from "../hooks/useLeagueActivity";
import { db } from "../lib/firebase";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { getOffseasonTeamPreparationState, normalizeOffseasonPreparation } from "../lib/offseasonPreparation";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import {
  getSeasonPresetLabel,
  normalizeSeasonConfig,
  SUPPORTED_LEAGUE_SIZES,
} from "../lib/seasonConfig";
import { startNextSeason } from "../lib/seasonHistory";
import { formatMoney } from "../lib/contracts";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { getUserFriendlyError } from "../lib/clientErrors";
import "../leagueLobby.css";

function LeagueLobbyPage() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const {
    activeLeagueId,
    activeLeague,
    members: activeMembers,
    teams,
    leagueLoading,
    joinLeague,
    selectLeague,
    setReady,
    startDraft,
    startSeason,
    leaveLeague,
    leaveLeagueDynasty,
    archiveLeague,
    cancelLeague,
  } = useLeague();
  const navigate = useNavigate();
  const isActiveLeague = activeLeagueId === leagueId;
  const { contracts, contractsInitialized, payroll, salaryCap, validation: contractValidation } = useLeagueContracts({
    enabled: isActiveLeague && activeLeague?.status === LEAGUE_STATUS.OFFSEASON,
  });
  const location = useLocation();
  const [inviteLeague, setInviteLeague] = useState(null);
  const [resolvedRouteLeagueId, setResolvedRouteLeagueId] = useState(null);
  const [inviteMembers, setInviteMembers] = useState([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const observedPhase = useRef({ leagueId: null, status: null });
  const league = isActiveLeague ? activeLeague || inviteLeague : inviteLeague;
  const members = isActiveLeague ? activeMembers : inviteMembers;
  const isMember = Boolean(league?.memberIds?.includes(user.uid));
  const activityState = useLeagueActivity(leagueId, isActiveLeague && isMember);

  useEffect(() => {
    if (!league) return;

    const previous = observedPhase.current;
    const isFirstObservation = previous.leagueId !== league.id;
    observedPhase.current = { leagueId: league.id, status: league.status };

    if (
      !isFirstObservation &&
      previous.status !== LEAGUE_STATUS.DRAFTING &&
      league.status === LEAGUE_STATUS.DRAFTING &&
      isActiveLeague &&
      isMember
    ) {
      navigate("/league/draft", { replace: true });
    }
  }, [isActiveLeague, isMember, league, navigate]);

  useEffect(() => {
    setInviteLeague(null);
    setResolvedRouteLeagueId(null);
    setInviteMembers([]);
    setError("");
    setInviteCopied(false);

    if (isActiveLeague) {
      setResolvedRouteLeagueId(leagueId);
      return undefined;
    }

    return onSnapshot(
      doc(db, "leagues", leagueId),
      (snapshot) => {
        setInviteLeague(
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        );
        if (!snapshot.exists())
          setError("No league was found with this invite link.");
        setResolvedRouteLeagueId(leagueId);
      },
      () => {
        setError("This league invite is unavailable.");
        setResolvedRouteLeagueId(leagueId);
      },
    );
  }, [isActiveLeague, leagueId]);

  useEffect(() => {
    if (isActiveLeague || !isMember) {
      setInviteMembers([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, "leagues", leagueId, "members"), orderBy("joinedAt")),
      (snapshot) =>
        setInviteMembers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      () => setError("Could not load league members."),
    );
  }, [isActiveLeague, isMember, leagueId]);

  async function run(actionName, action, onSuccess) {
    setError("");
    setBusyAction(actionName);
    try {
      await action();
      onSuccess?.();
    } catch (nextError) {
      setError(getUserFriendlyError(nextError, "That league action could not be completed."));
    } finally {
      setBusyAction("");
    }
  }

  async function join() {
    await run("join", () => joinLeague(leagueId), () =>
      navigate(`/league/${leagueId}`, { replace: true }),
    );
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/league/${leagueId}`);
      setInviteCopied(true);
    } catch {
      setError("The invite link could not be copied. Copy it from the field instead.");
    }
  }

  const routeLeagueLoading = resolvedRouteLeagueId !== leagueId;
  if (
    (routeLeagueLoading && !(isActiveLeague && activeLeague)) ||
    (isActiveLeague && leagueLoading && !inviteLeague)
  )
    return (
      <PageLayout>
        <div className="route-loader">Loading league headquarters...</div>
      </PageLayout>
    );
  if (!league)
    return (
      <PageLayout>
        <section className="empty-state">
          <h2>League unavailable.</h2>
          <p>{error}</p>
          <Link to="/league">League HQ</Link>
        </section>
      </PageLayout>
    );

  const inviteLink = `${window.location.origin}/league/${leagueId}`;
  const seasonConfig = normalizeSeasonConfig(
    league.maxMembers,
    league.seasonConfig,
  );
  const rosterConfig = normalizeRosterConfig(league);
  const memberCount = isMember ? members.length : league.memberIds?.length || 0;
  const readyCount = members.filter((member) => member.ready === true).length;
  const currentMember = members.find((member) => member.uid === user.uid);
  const commissioner = members.find(
    (member) => member.uid === league.commissionerUid,
  );
  const isCommissioner = league.commissionerUid === user.uid;
  const lobbyOpen = league.status === LEAGUE_STATUS.LOBBY;
  const memberConditionMet = memberCount === league.maxMembers;
  const readinessConditionMet = memberCount > 0 && readyCount === memberCount;
  const seasonConfirmedIds = league.seasonReadyMemberIds || [];
  const seasonReadyTeams = teams.filter(
    (team) =>
      seasonConfirmedIds.includes(team.ownerUid) &&
      isLeagueTeamSeasonReady(team, league),
  );
  const seasonReadyCount = seasonReadyTeams.length;
  const offseasonPreparation = normalizeOffseasonPreparation(league);
  const offseasonReadyTeams = teams.filter((team) => getOffseasonTeamPreparationState({ league, team, userId: team.ownerUid, contracts }).ready);
  const offseasonReadyCount = offseasonReadyTeams.length;
  const scheduleSizeReady = SUPPORTED_LEAGUE_SIZES.includes(memberCount);
  const allOffseasonTeamsReady = scheduleSizeReady && offseasonReadyCount === memberCount && offseasonPreparation.readyMemberIds.length === memberCount;
  const allTeamsSeasonReady =
    memberCount > 0 &&
    seasonReadyCount === memberCount &&
    members.every((member) =>
      seasonReadyTeams.some((team) => team.ownerUid === member.uid),
    );
  const canStartSeason =
    isCommissioner &&
    league.status === LEAGUE_STATUS.SEASON_READY &&
    allTeamsSeasonReady;
  const canStartDraft =
    isCommissioner && lobbyOpen && memberConditionMet && readinessConditionMet;
  const teamByOwner = new Map(teams.map((team) => [team.ownerUid, team]));
  const phaseSummary = (() => {
    switch (league.status) {
      case LEAGUE_STATUS.DRAFTING:
        return {
          label: "DRAFT PROGRESS",
          value: "DRAFT ACTIVE",
          detail: `${memberCount}/${league.maxMembers} teams drafting`,
        };
      case LEAGUE_STATUS.SEASON_READY:
        return {
          label: "TEAM PREPARATION",
          value: `${seasonReadyCount}/${memberCount} READY`,
          detail: "Draft complete / lineups required",
        };
      case LEAGUE_STATUS.CANCELLED:
        return {
          label: "LEAGUE LIFECYCLE",
          value: "CANCELLED",
          detail: "This league is no longer active",
        };
      case LEAGUE_STATUS.ARCHIVED:
        return { label: "LEAGUE LIFECYCLE", value: "ARCHIVED", detail: "Read-only dynasty history" };
      case LEAGUE_STATUS.OFFSEASON:
        return {
          label: `OFFSEASON — PREPARING FOR SEASON ${offseasonPreparation.nextSeason}`,
          value: `${offseasonReadyCount}/${memberCount} READY`,
          detail: `Season ${league.offseason?.seasonCompleted || league.season} complete`,
        };
      case LEAGUE_STATUS.REGULAR_SEASON:
        return {
          label: "REGULAR SEASON",
          value: league.seasonProgress?.currentRound ? `ROUND ${league.seasonProgress.currentRound}` : "SEASON ACTIVE",
          detail: `${memberCount} active franchises`,
        };
      case LEAGUE_STATUS.PLAYOFFS:
        return {
          label: "POSTSEASON",
          value: league.postseason?.status === "completed" ? "COMPLETE" : "PLAYOFFS ACTIVE",
          detail: league.postseason?.champion?.teamName || `${memberCount} league franchises`,
        };
      default:
        return {
          label: "LOBBY READINESS",
          value: `${readyCount}/${memberCount} READY`,
          detail: `${memberCount}/${league.maxMembers} teams joined`,
        };
    }
  })();
  const accessMessage =
    league.status === LEAGUE_STATUS.SEASON_READY
      ? null
      : location.state?.leagueAccessMessage;

  return (
    <PageLayout>
      <section className="page-hero league-hero league-command-header">
        <p className="section-label">LEAGUE CONTROL ROOM</p>
        <h1>{league.name}<span>.</span></h1>
        <div className="league-command-header__meta">
          <span>Season {league.season}</span>
          <b>{getLeagueStatusLabel(league.status)}</b>
          <span>{memberCount}/{league.maxMembers} Teams</span>
          <span>Commissioner: {commissioner?.displayName || "Loading"}</span>
        </div>
      </section>

      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}

      {isActiveLeague && isMember && <div className="league-primary-action"><LeagueProgress contracts={contracts} /></div>}

      <section className={`league-lobby league-dashboard-summary ${!lobbyOpen ? "is-quiet" : ""}`}>
        <div className="league-code">
          <span>INVITE CODE</span><b>{league.inviteCode}</b><small>{inviteLink}</small>
          {league.status !== LEAGUE_STATUS.ARCHIVED && <button type="button" onClick={copyInvite}>{inviteCopied ? "Copied" : "Copy Invite Link"}</button>}
        </div>
        <div className="league-status">
          <span>LEAGUE FORMAT</span><b>{getSeasonPresetLabel(seasonConfig.preset)}</b>
          <small>{seasonConfig.gamesPerTeam} games per team</small>
          <small>{rosterConfig.rosterSize} players · {rosterConfig.starterCount} starters · {rosterConfig.benchSize} bench</small>
        </div>
        <div className="league-next">
          <span>FRANCHISE READINESS</span><b>{phaseSummary.value}</b>
          <small>{phaseSummary.detail}</small>
        </div>
      </section>

      {isMember && (
        <section className="franchise-list">
          <div className="section-heading">
            <div><p className="section-label">FRANCHISES</p><h2>League members <span>{memberCount}/{league.maxMembers} joined</span></h2></div>
          </div>
          {members.map((member, index) => (
            <article key={member.id}>
              <strong className="franchise-list__avatar" aria-hidden="true">{member.displayName?.trim()?.charAt(0)?.toUpperCase() || String(index + 1)}</strong>
              <span className="franchise-list__identity"><b><Link className="gm-profile-link" to={`/profile/${member.uid}`}>{member.displayName}</Link></b><small>{teamByOwner.get(member.uid)?.name || "Franchise pending"}{member.role === "commissioner" ? " · Commissioner" : ""}</small></span>
              <span className="franchise-list__roster">ROSTER <b>{teamByOwner.get(member.uid)?.roster?.length || 0}/{rosterConfig.rosterSize}</b></span>
              <i className={
                (league.status === LEAGUE_STATUS.SEASON_READY
                  ? seasonReadyTeams.some((team) => team.ownerUid === member.uid)
                  : league.status === LEAGUE_STATUS.OFFSEASON
                    ? offseasonReadyTeams.some((team) => team.ownerUid === member.uid)
                  : member.ready)
                  ? "is-ready"
                  : "is-not-ready"
              }>
                {league.status === LEAGUE_STATUS.SEASON_READY
                  ? seasonReadyTeams.some((team) => team.ownerUid === member.uid)
                    ? "READY FOR SEASON"
                    : "NOT READY FOR SEASON"
                  : league.status === LEAGUE_STATUS.OFFSEASON
                    ? offseasonReadyTeams.some((team) => team.ownerUid === member.uid)
                      ? `READY FOR SEASON ${offseasonPreparation.nextSeason}`
                      : "NOT READY"
                  : member.ready
                    ? "READY"
                    : "NOT READY"}
              </i>
            </article>
          ))}
          {Array.from({ length: Math.max(0, league.maxMembers - memberCount) }).map((_, index) => (
            <article className="franchise-list__empty" key={`empty-${index}`}>
              <strong className="franchise-list__avatar">+</strong><span className="franchise-list__identity"><b>Open franchise</b><small>Waiting for invite</small></span><span className="franchise-list__roster">ROSTER <b>0/{rosterConfig.rosterSize}</b></span><i>OPEN</i>
            </article>
          ))}
        </section>
      )}

      {isActiveLeague && isMember && <LeagueActivityFeed {...activityState} />}

      {isMember && lobbyOpen && (
        <section className="league-control-panel" id="league-controls">
          <div>
            <p className="section-label">YOUR STATUS</p>
            <h2>{currentMember?.ready ? "Ready for draft" : "Not ready"}</h2>
            <p>You can change readiness until the commissioner starts the draft phase.</p>
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => run("ready", () => setReady(!currentMember?.ready))}
            >
              {busyAction === "ready" ? "Saving..." : currentMember?.ready ? "Mark Not Ready" : "Mark Ready"}
            </button>
          </div>

          {isCommissioner ? (
            <div className="league-commissioner-controls">
              <p className="section-label">COMMISSIONER CONTROLS</p>
              <h2>{canStartDraft ? "Draft can start" : "Waiting on lobby"}</h2>
              <ul>
                <li className={memberConditionMet ? "is-complete" : ""}>League full: {memberCount}/{league.maxMembers}</li>
                <li className={readinessConditionMet ? "is-complete" : ""}>Members ready: {readyCount}/{memberCount}</li>
              </ul>
              <div className="league-control-actions">
                <button
                  type="button"
                  disabled={!canStartDraft || Boolean(busyAction)}
                  onClick={() => run("start", startDraft)}
                >
                  {busyAction === "start" ? "Starting..." : "Start Draft"}
                </button>
                {!confirmCancel ? (
                  <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => setConfirmCancel(true)}>Cancel League</button>
                ) : (
                  <div className="league-cancel-confirm">
                    <p>Cancel this league and clear every member’s active league reference?</p>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => run("cancel", cancelLeague, () => navigate("/league", { replace: true }))}>
                      {busyAction === "cancel" ? "Cancelling..." : "Confirm Cancellation"}
                    </button>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmCancel(false)}>Keep League</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="league-member-controls">
              <p className="section-label">MEMBER CONTROLS</p>
              <h2>Leave league</h2>
              <p>Available only in the lobby and before acquiring roster players.</p>
              {!confirmLeave ? <button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => setConfirmLeave(true)}>Leave League</button> : <div className="league-lifecycle-confirm" role="alertdialog" aria-label="Confirm league departure"><p>You will leave this active league and your current franchise will be removed. This cannot be undone automatically.</p><button type="button" className="is-danger" disabled={Boolean(busyAction)} onClick={() => run("leave", leaveLeague, () => navigate("/league", { replace: true }))}>{busyAction === "leave" ? "Leaving..." : "Confirm Leave"}</button><button type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmLeave(false)}>Keep Membership</button></div>}
            </div>
          )}
        </section>
      )}

      {league.status === LEAGUE_STATUS.SEASON_READY && isMember && isCommissioner && (
        <section className="league-control-panel league-control-panel--single" id="league-controls">
          <div className="league-commissioner-controls">
            <p className="section-label">COMMISSIONER</p>
            <h2>{canStartSeason ? "Season can start" : "Waiting on lineups"}</h2>
            <p>{seasonReadyCount}/{memberCount} franchises ready.</p>
            <button type="button" disabled={!canStartSeason || Boolean(busyAction)} onClick={() => run("season", startSeason)}>
              {busyAction === "season" ? "Starting..." : "Start Season"}
            </button>
          </div>
        </section>
      )}

      {league.status === LEAGUE_STATUS.OFFSEASON && isMember && (
        <section className="league-phase-notice" id="league-controls">
          <p className="section-label">SEASON {league.offseason?.seasonCompleted || league.season} COMPLETE</p>
          <h2>🏆 {league.postseason?.champion?.teamName}</h2>
          <p>Runner-up: {league.postseason?.runnerUp?.teamName}</p>
          <p>The league has entered offseason. Season {league.offseason?.nextSeason || league.season + 1} preparation will happen here.</p>
          <p>Franchises ready: {offseasonReadyCount} / {memberCount}</p>
          {!scheduleSizeReady && <p role="status">The next season requires 2, 4, 6, or 8 remaining franchises.</p>}
          <p className="offseason-finance-summary"><b>CONTRACTS</b> {contractsInitialized ? contractValidation.valid ? "READY" : "REVIEW REQUIRED" : "INITIALIZATION REQUIRED"} <span>PAYROLL {contractsInitialized ? `${formatMoney(payroll)} / ${formatMoney(salaryCap)}` : "—"}</span></p>
          {isCommissioner ? (
            <button className="button-primary" type="button" disabled={!allOffseasonTeamsReady || Boolean(busyAction)} onClick={() => run("next-season", () => startNextSeason({ leagueId }))}>
              {busyAction === "next-season" ? "Preparing Next Season..." : `Start Season ${offseasonPreparation.nextSeason}`}
            </button>
          ) : <small>{allOffseasonTeamsReady ? `All franchises are ready. Waiting for the commissioner to start Season ${offseasonPreparation.nextSeason}.` : "Waiting for the remaining franchises."}</small>}
          <div className="league-lifecycle-management">
            <div><p className="section-label">LEAGUE MANAGEMENT</p><strong>{isCommissioner ? "Dynasty controls" : "Membership"}</strong></div>
            {!isCommissioner && <div className="league-lifecycle-actions"><Link className="button-secondary" to="/my-team">Continue Preparation</Link>{!confirmLeave ? <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmLeave(true)}>Leave League</button> : <div className="league-lifecycle-confirm" role="alertdialog" aria-label="Confirm league departure"><p>You will leave this active league. Your current roster, ownership, and contracts will be released. Completed season history remains. This cannot be undone automatically.</p><button className="is-danger" type="button" disabled={Boolean(busyAction)} onClick={() => run("dynasty-leave", leaveLeagueDynasty, () => navigate("/league", { replace: true }))}>{busyAction === "dynasty-leave" ? "Leaving..." : "Release Franchise & Leave"}</button><button type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmLeave(false)}>Keep Membership</button></div>}</div>}
            {isCommissioner && (!confirmArchive ? <button className="button-secondary" type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmArchive(true)}>Archive League</button> : <div className="league-lifecycle-confirm" role="alertdialog" aria-label="Confirm league archive"><p>This league will become permanently read-only. No future season can start; history remains, and members can create or join another league. Archive is not deletion and cannot currently be undone.</p><button className="is-danger" type="button" disabled={Boolean(busyAction)} onClick={() => run("archive", archiveLeague, () => navigate(`/league/${leagueId}`, { replace: true }))}>{busyAction === "archive" ? "Archiving..." : "Archive League"}</button><button type="button" disabled={Boolean(busyAction)} onClick={() => setConfirmArchive(false)}>Keep League Active</button></div>)}
          </div>
        </section>
      )}

      {league.status === LEAGUE_STATUS.ARCHIVED && isMember && <section className="league-phase-notice league-phase-notice--archived"><p className="section-label">ARCHIVED DYNASTY</p><h2>{league.name} is read-only.</h2><p>No games, roster moves, or future seasons can begin. Completed championships and season records remain preserved.</p><Link className="button-secondary" to={`/league/${leagueId}/history`}>View Season History</Link></section>}

      {lobbyOpen && !isMember && (
        <section className="league-join">
          <p>Use this invite to reserve your franchise.</p>
          <button onClick={join} disabled={Boolean(busyAction)}>{busyAction === "join" ? "Joining..." : "Join this league"}</button>
        </section>
      )}
      {!isActiveLeague && isMember && league.status !== LEAGUE_STATUS.ARCHIVED && (
        <section className="league-join">
          <p>You are already a member of this league. Open it as your active league to use its member controls.</p>
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => run("select", () => selectLeague(leagueId))}
          >
            {busyAction === "select" ? "Opening..." : "Open this league"}
          </button>
        </section>
      )}
      {error && <p className="league-error" role="alert">{error}</p>}
    </PageLayout>
  );
}

export default LeagueLobbyPage;
