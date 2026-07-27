import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { db } from "../lib/firebase";
import { joinMatchRoom, setMatchReady, startMatchRoom } from "../lib/matches";
import {
  getMissingLineupPositions,
  getTeamOverall,
  isLineupComplete,
} from "../utils/team";

function MatchRoomPage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const { activeLeagueId, roster, lineup } = useLeagueTeam();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "matches", matchId),
        (snapshot) =>
          setMatch(
            snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
          ),
        () => setError("You do not have access to this match room."),
      ),
    [matchId],
  );
  const side = useMemo(
    () =>
      !match
        ? null
        : match.hostUid === user.uid
          ? "host"
          : match.guestUid === user.uid
            ? "guest"
            : null,
    [match, user.uid],
  );
  const bothReady = Boolean(match?.ready?.host && match?.ready?.guest);
  const currentMissingPositions = getMissingLineupPositions(roster, lineup);
  const currentLineupReady = isLineupComplete(roster, lineup);
  const hostMissingPositions = getMissingLineupPositions(
    match?.host?.players || [],
    match?.host?.lineup,
  );
  const guestMissingPositions = getMissingLineupPositions(
    match?.guest?.players || [],
    match?.guest?.lineup,
  );
  const matchLineupsReady =
    hostMissingPositions.length === 0 && guestMissingPositions.length === 0;
  const ownMatchLineupReady = side
    ? isLineupComplete(match?.[side]?.players || [], match?.[side]?.lineup)
    : false;
  const inviteLink = `${window.location.origin}/match/${matchId}`;

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy the invite link from your browser address bar.");
    }
  }

  if (!match && !error)
    return (
      <PageLayout>
        <div className="route-loader">Loading match room...</div>
      </PageLayout>
    );
  if (!match)
    return (
      <PageLayout>
        <section className="empty-state">
          <h2>Match room unavailable.</h2>
          <p>{error}</p>
        </section>
      </PageLayout>
    );

  return (
    <PageLayout>
      <section className="page-hero online-hero">
        <p className="section-label">ONLINE MATCH ROOM</p>
        <h1>
          Ready for <span>tip-off?</span>
        </h1>
        <p>
          Room code: <b>{match.inviteCode}</b>
        </p>
      </section>
      <section className="match-room">
        <div className="invite-bar">
          <div>
            <span>INVITE LINK</span>
            <b>{inviteLink}</b>
          </div>
          <button onClick={copyInvite}>
            {copied ? "Copied" : "Copy invite"}
          </button>
        </div>
        <div className="online-matchup">
          <TeamPanel
            label="HOME"
            player={match.host}
            ready={match.ready?.host}
            missingPositions={hostMissingPositions}
          />
          <div className="online-versus">
            <span>VS</span>
            <small>
              {bothReady ? "BOTH TEAMS READY" : "WAITING FOR READY CHECK"}
            </small>
          </div>
          <TeamPanel
            label="AWAY"
            player={match.guest}
            ready={match.ready?.guest}
            emptyLabel="Friend has not joined yet"
            missingPositions={guestMissingPositions}
          />
        </div>
        {!side && !match.guestUid && (
          <button
            className="room-action"
            disabled={busy || !currentLineupReady}
            onClick={() =>
              run(() =>
                joinMatchRoom(matchId, {
                  user,
                  leagueId: activeLeagueId,
                  roster,
                  lineup,
                }),
              )
            }
          >
            {busy ? "Joining..." : "Join this match"}
          </button>
        )}
        {!side && !match.guestUid && !currentLineupReady && (
          <p className="online-error">
            Your lineup is missing: {currentMissingPositions.join(", ")}.
          </p>
        )}
        {side && match.status === "waiting" && (
          <div className="ready-actions">
            <button
              className={`room-action ${match.ready?.[side] ? "is-ready" : ""}`}
              disabled={busy || !match.guestUid || !ownMatchLineupReady}
              onClick={() =>
                run(() =>
                  setMatchReady(matchId, user.uid, !match.ready?.[side]),
                )
              }
            >
              {match.ready?.[side]
                ? "Ready - click to undo"
                : "Mark team ready"}
            </button>
            {bothReady && (
              <button
                className="room-start"
                disabled={busy || !matchLineupsReady}
                onClick={() =>
                  run(async () => {
                    await startMatchRoom(matchId, user.uid);
                    navigate(`/match/${matchId}/live`);
                  })
                }
              >
                Start match
              </button>
            )}
            {!ownMatchLineupReady && (
              <p className="online-error">
                Your saved lineup is missing:{" "}
                {side === "host"
                  ? hostMissingPositions.join(", ")
                  : guestMissingPositions.join(", ")}
                .
              </p>
            )}
            {bothReady && !matchLineupsReady && (
              <p className="online-error">
                Both teams need PG, SG, SF, PF, and C assignments before
                tip-off.
              </p>
            )}
          </div>
        )}
        {(match.status === "in_progress" || match.status === "completed") && (
          <Link className="match-live" to={`/match/${matchId}/live`}>
            {match.status === "completed"
              ? "MATCH COMPLETE - View the final result."
              : "MATCH STARTED - Enter the live arena."}
          </Link>
        )}
        {error && (
          <p className="online-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </PageLayout>
  );
}

function TeamPanel({ label, player, ready, emptyLabel, missingPositions }) {
  if (!player)
    return (
      <div className="online-team online-team--empty">
        <span>{label}</span>
        <b>{emptyLabel}</b>
        <small>Share the invite link to fill this bench.</small>
      </div>
    );
  return (
    <div className="online-team">
      <span>{label}</span>
      <b>{player.name}</b>
      <strong>{getTeamOverall(player.players || [])}</strong>
      <small>TEAM OVR</small>
      <div>
        {(player.players || []).map((member) => (
          <i key={member.id} title={member.name}>
            {member.position}
          </i>
        ))}
      </div>
      <em className={ready ? "ready" : ""}>
        {missingPositions.length
          ? `MISSING: ${missingPositions.join(", ")}`
          : ready
            ? "READY"
            : "NOT READY"}
      </em>
    </div>
  );
}

export default MatchRoomPage;
