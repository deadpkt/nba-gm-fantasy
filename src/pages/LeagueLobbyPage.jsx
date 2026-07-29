import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { isLeagueTeamSeasonReady } from "../lib/leagueTeams";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import {
  getSeasonPresetLabel,
  normalizeSeasonConfig,
} from "../lib/seasonConfig";

function getLeaguePhaseMessage(status) {
  switch (status) {
    case LEAGUE_STATUS.LOBBY:
      return "The league lobby is open. Fill every franchise slot and ready up before the draft phase.";
    case LEAGUE_STATUS.DRAFTING:
      return "The shared draft is active. Follow the draft room until every franchise has five players.";
    case LEAGUE_STATUS.SEASON_READY:
      return "Draft complete. Set your lineup and prepare for the season.";
    case LEAGUE_STATUS.CANCELLED:
      return "This league has been cancelled.";
    default:
      return `League phase: ${getLeagueStatusLabel(status)}.`;
  }
}

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
    cancelLeague,
  } = useLeague();
  const navigate = useNavigate();
  const location = useLocation();
  const [inviteLeague, setInviteLeague] = useState(null);
  const [resolvedRouteLeagueId, setResolvedRouteLeagueId] = useState(null);
  const [inviteMembers, setInviteMembers] = useState([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const observedPhase = useRef({ leagueId: null, status: null });
  const isActiveLeague = activeLeagueId === leagueId;
  const league = isActiveLeague ? activeLeague || inviteLeague : inviteLeague;
  const members = isActiveLeague ? activeMembers : inviteMembers;
  const isMember = Boolean(league?.memberIds?.includes(user.uid));

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
  }, [leagueId]);

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
      setError(nextError.message);
    } finally {
      setBusyAction("");
    }
  }

  async function join() {
    await run("join", () => joinLeague(leagueId), () =>
      navigate(`/league/${leagueId}`, { replace: true }),
    );
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
      isLeagueTeamSeasonReady(team),
  );
  const seasonReadyCount = seasonReadyTeams.length;
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
      <section className="page-hero league-hero">
        <p className="section-label">PRIVATE LEAGUE / SEASON {league.season}</p>
        <h1>{league.name}<span>.</span></h1>
        <p>{getLeaguePhaseMessage(league.status)}</p>
      </section>

      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}

      <section className="league-lobby league-dashboard-summary">
        <div className="league-code">
          <span>INVITE CODE</span><b>{league.inviteCode}</b><small>{inviteLink}</small>
        </div>
        <div className="league-status">
          <span>LEAGUE STATUS</span><b className={`league-status-chip league-status-chip--${league.status}`}>{getLeagueStatusLabel(league.status)}</b>
          <small>Season {league.season} / Commissioner: {commissioner?.displayName || "Loading"}</small>
          <small>{getSeasonPresetLabel(seasonConfig.preset)} / {seasonConfig.gamesPerTeam} games per team</small>
        </div>
        <div className="league-next">
          <span>{phaseSummary.label}</span><b>{phaseSummary.value}</b>
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
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <span>{member.role === "commissioner" ? "COMMISSIONER" : "FRANCHISE OWNER"}</span>
              <b>{member.displayName}</b>
              <i className={
                (league.status === LEAGUE_STATUS.SEASON_READY
                  ? seasonReadyTeams.some((team) => team.ownerUid === member.uid)
                  : member.ready)
                  ? "is-ready"
                  : "is-not-ready"
              }>
                {league.status === LEAGUE_STATUS.SEASON_READY
                  ? seasonReadyTeams.some((team) => team.ownerUid === member.uid)
                    ? "READY FOR SEASON"
                    : "NOT READY FOR SEASON"
                  : member.ready
                    ? "READY"
                    : "NOT READY"}
              </i>
            </article>
          ))}
          {Array.from({ length: Math.max(0, league.maxMembers - memberCount) }).map((_, index) => (
            <article className="franchise-list__empty" key={`empty-${index}`}>
              <strong>--</strong><span>OPEN FRANCHISE</span><b>Waiting for invite</b><i>OPEN</i>
            </article>
          ))}
        </section>
      )}

      {isMember && lobbyOpen && (
        <section className="league-control-panel">
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
              <button
                type="button"
                className="is-danger"
                disabled={Boolean(busyAction)}
                onClick={() => run("leave", leaveLeague, () => navigate("/league", { replace: true }))}
              >
                {busyAction === "leave" ? "Leaving..." : "Leave League"}
              </button>
            </div>
          )}
        </section>
      )}

      {league.status === LEAGUE_STATUS.DRAFTING && isMember && (
        <section className="league-phase-notice">
          <p className="section-label">DRAFT PHASE ACTIVE</p>
          <h2>The shared league draft is underway.</h2>
          <p>Continue drafting until every franchise has completed its roster.</p>
          <Link to="/league/draft">Open Draft Room</Link>
        </section>
      )}

      {league.status === LEAGUE_STATUS.SEASON_READY && isMember && (
        <section className="league-control-panel">
          <div>
            <p className="section-label">DRAFT COMPLETE / TEAM PREPARATION</p>
            <h2>{seasonReadyCount}/{memberCount} franchises ready</h2>
            <p>Each franchise needs exactly five drafted players and one roster player assigned at PG, SG, SF, PF, and C.</p>
            <Link to="/my-team">Open My Team</Link>
          </div>
          {isCommissioner && (
            <div className="league-commissioner-controls">
              <p className="section-label">COMMISSIONER CONTROLS</p>
              <h2>{canStartSeason ? "Season can start" : "Waiting on lineups"}</h2>
              <ul>
                <li className={seasonReadyCount === memberCount ? "is-complete" : ""}>
                  Franchises ready: {seasonReadyCount}/{memberCount}
                </li>
              </ul>
              <button
                type="button"
                disabled={!canStartSeason || Boolean(busyAction)}
                onClick={() => run("season", startSeason)}
              >
                {busyAction === "season" ? "Starting..." : "Start Season"}
              </button>
            </div>
          )}
        </section>
      )}

      {lobbyOpen && !isMember && (
        <section className="league-join">
          <p>Use this invite to reserve your franchise.</p>
          <button onClick={join} disabled={Boolean(busyAction)}>{busyAction === "join" ? "Joining..." : "Join this league"}</button>
        </section>
      )}
      {!isActiveLeague && isMember && (
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
