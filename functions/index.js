import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { defineSecret } from "firebase-functions/params";
import {
  buildOfficialGameActivation,
  buildOfficialCompletion,
} from "./lib/completeOfficialGame.js";
import {
  createSeasonProgress,
  isGameProgressionComplete,
  isRoundProgressionComplete,
  nextRoundToStart,
  ROUND_STATUS,
} from "./shared/seasonProgress.js";
import { buildRegularSeasonFinalization } from "./shared/postseason.js";
import { buildChampionship, buildFinalMatchup, buildPlayoffInitialization } from "./shared/playoffs.js";
import { buildPresentationWindow, isPresentationDeadlineReached } from "./shared/presentationTiming.js";
import { buildOffseasonTransition, buildSeasonHistory, seasonHistoryMatches } from "./shared/seasonHistory.js";
import { buildNextSeasonTransition, isNextSeasonCommissioner, isNextSeasonTransitionRetry } from "./shared/nextSeason.js";
import { buildArchiveUpdate, buildDepartingMemberUpdate, canArchiveLeague, canLeaveLeagueDynasty } from "./shared/leagueLifecycle.js";
import { ageContractForSeason, initializeMissingContracts, validateTeamContracts } from "./shared/contracts.js";
import { buildFreeAgentSigning, buildPlayerRelease } from "./shared/freeAgency.js";
import { canBuildLegalStartingFive, getDraftRosterFeasibility } from "./shared/lineupFeasibility.js";
import { buildPreseasonRosterRepair } from "./shared/preseasonRosterRepair.js";
import { buildDraftTurnWindow, draftTurnIdentity, draftTurnMatches, isDraftTurnExpired, selectDeterministicAutoPick } from "./shared/draftTimer.js";
import { syncNbaCatalog as runNbaCatalogSync } from "./lib/syncNbaCatalog.js";
import { normalizeRosterConfig } from "./shared/rosterConfig.js";
import { buildFollowMutation, buildPublicProfile, validateFollowTarget } from "./shared/social.js";
import { clearTrustedNotifications, createTrustedNotification, createTrustedNotifications, deleteTrustedNotification, markAllTrustedNotificationsRead, markTrustedNotificationRead, notificationEventId } from "./lib/notifications.js";
import { activityEventId, createTrustedLeagueActivity } from "./lib/leagueActivity.js";
import { devLogIdForVersion, newestPublished, normalizeDevLog } from "./shared/devLogs.js";
import { publishRatingsPreview, rollbackPlayerCatalog } from "./lib/catalogPublication.js";
import { approveCalibrationReview, revokeCalibrationReview, setLicensingReview } from "./lib/ratingsReview.js";
import { catalogPlayersPath } from "./shared/catalogVersion.js";
import { buildLeaguePlayerSnapshot } from "./shared/playerSnapshot.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const balldontlieApiKey = defineSecret("BALLDONTLIE_API_KEY");

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "You do not have permission to manage Dev Logs.");
}

export const saveDevLogDraft = onCall(async (request) => {
  requireAdmin(request);
  let content;
  try { content = normalizeDevLog(request.data || {}); } catch (error) { throw new HttpsError("invalid-argument", error.message); }
  const id = devLogIdForVersion(content.version);
  const ref = db.doc(`devLogs/${id}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists && request.data?.id !== id) {
      throw new HttpsError("already-exists", "A Dev Log with this version already exists.");
    }
    if (snapshot.exists && snapshot.data().status === "published") throw new HttpsError("failed-precondition", "Unpublish this update before editing it.");
    const now = Timestamp.now();
    if (snapshot.exists) transaction.update(ref, { ...content, status: "draft", updatedAt: now });
    else transaction.create(ref, { ...content, status: "draft", publishedAt: null, createdAt: now, updatedAt: now, createdBy: request.auth.uid });
    return { id, status: "draft" };
  });
});

export const setDevLogPublication = onCall(async (request) => {
  requireAdmin(request);
  const { id, published } = request.data || {};
  if (typeof id !== "string" || typeof published !== "boolean") throw new HttpsError("invalid-argument", "Update identity and publication state are required.");
  const ref = db.doc(`devLogs/${id}`);
  const metaRef = db.doc("appMeta/current");
  return db.runTransaction(async (transaction) => {
    const [snapshot, allLogs] = await Promise.all([transaction.get(ref), transaction.get(db.collection("devLogs"))]);
    if (!snapshot.exists) throw new HttpsError("not-found", "Dev Log unavailable.");
    const current = snapshot.data();
    if (published && current.status === "published") return { id, status: "published", alreadyPublished: true };
    if (!published && current.status === "draft") return { id, status: "draft", alreadyUnpublished: true };
    const now = Timestamp.now();
    if (published) {
      let content;
      try { content = normalizeDevLog(current, { publishing: true }); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      transaction.update(ref, { ...content, status: "published", publishedAt: now, updatedAt: now });
      transaction.set(metaRef, { latestPublishedVersion: content.version, latestDevLogId: id, latestPublishedAt: now });
      return { id, status: "published" };
    }
    transaction.update(ref, { status: "draft", publishedAt: null, updatedAt: now });
    const latest = newestPublished(allLogs.docs.filter((item) => item.id !== id).map((item) => ({ id: item.id, ...item.data() })));
    if (latest) transaction.set(metaRef, { latestPublishedVersion: latest.version, latestDevLogId: latest.id, latestPublishedAt: latest.publishedAt });
    else transaction.delete(metaRef);
    return { id, status: "draft" };
  });
});

export const deleteDevLog = onCall(async (request) => {
  requireAdmin(request);
  const id = request.data?.id;
  if (typeof id !== "string") throw new HttpsError("invalid-argument", "An update identity is required.");
  const ref = db.doc(`devLogs/${id}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { deleted: false, alreadyDeleted: true };
    if (snapshot.data().status === "published") throw new HttpsError("failed-precondition", "Unpublish this update before deleting it.");
    transaction.delete(ref);
    return { deleted: true };
  });
});

export const markNotificationRead = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const notificationId = request.data?.notificationId;
  if (typeof notificationId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(notificationId)) {
    throw new HttpsError("invalid-argument", "A valid notification ID is required.");
  }
  const result = await markTrustedNotificationRead(db, request.auth.uid, notificationId);
  if (!result.found) throw new HttpsError("not-found", "Notification unavailable.");
  return { read: true, alreadyRead: !result.changed };
});

export const markAllNotificationsRead = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return markAllTrustedNotificationsRead(db, request.auth.uid);
});

export const deleteNotification = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const notificationId = request.data?.notificationId;
  if (typeof notificationId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(notificationId)) throw new HttpsError("invalid-argument", "A valid notification ID is required.");
  const result = await deleteTrustedNotification(db, request.auth.uid, notificationId);
  if (!result.found) throw new HttpsError("not-found", "Notification unavailable.");
  return result;
});

export const clearNotifications = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return clearTrustedNotifications(db, request.auth.uid, { readOnly: request.data?.readOnly === true });
});

export const ensurePublicProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { targetUid } = request.data || {};
  if (typeof targetUid !== "string" || !targetUid.trim()) throw new HttpsError("invalid-argument", "A profile UID is required.");
  const uid = targetUid.trim();
  const userRef = db.doc(`users/${uid}`);
  const publicRef = db.doc(`publicProfiles/${uid}`);
  return db.runTransaction(async (transaction) => {
    const [userSnapshot, publicSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(publicRef)]);
    if (!userSnapshot.exists) throw new HttpsError("not-found", "Profile unavailable.");
    if (publicSnapshot.exists) return { created: false };
    transaction.create(publicRef, buildPublicProfile(uid, userSnapshot.data(), {}, Timestamp.now()));
    return { created: true };
  });
});

async function mutateFollow(request, following) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  let targetUid;
  try { targetUid = validateFollowTarget(request.auth.uid, request.data?.targetUid); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }
  const callerUid = request.auth.uid;
  const callerUserRef = db.doc(`users/${callerUid}`);
  const targetUserRef = db.doc(`users/${targetUid}`);
  const callerProfileRef = db.doc(`publicProfiles/${callerUid}`);
  const targetProfileRef = db.doc(`publicProfiles/${targetUid}`);
  const followingRef = callerProfileRef.collection("following").doc(targetUid);
  const followerRef = targetProfileRef.collection("followers").doc(callerUid);
  const result = await db.runTransaction(async (transaction) => {
    const [callerUser, targetUser, callerPublic, targetPublic, followingEdge, followerEdge] = await Promise.all([
      transaction.get(callerUserRef), transaction.get(targetUserRef), transaction.get(callerProfileRef),
      transaction.get(targetProfileRef), transaction.get(followingRef), transaction.get(followerRef),
    ]);
    if (!callerUser.exists) throw new HttpsError("failed-precondition", "Your profile is unavailable.");
    if (!targetUser.exists) throw new HttpsError("not-found", "Profile unavailable.");
    const mutation = buildFollowMutation({ callerProfile: callerPublic.data(), targetProfile: targetPublic.data(), followingEdgeExists: followingEdge.exists, followerEdgeExists: followerEdge.exists, desiredFollowing: following });
    const callerDisplayName = callerPublic.data()?.displayName || callerUser.data()?.displayName || "A GM";
    if (!mutation.changed) {
      return { following, idempotent: true, callerDisplayName, followEventAtMs: followingEdge.data()?.createdAt?.toMillis?.() || null };
    }
    const now = Timestamp.now();
    const callerProfile = buildPublicProfile(callerUid, callerUser.data(), callerPublic.data() || {}, now);
    const targetProfile = buildPublicProfile(targetUid, targetUser.data(), targetPublic.data() || {}, now);
    const counts = buildFollowMutation({ callerProfile, targetProfile, followingEdgeExists: followingEdge.exists, followerEdgeExists: followerEdge.exists, desiredFollowing: following });
    transaction.set(callerProfileRef, { ...callerProfile, followingCount: counts.callerFollowingCount });
    transaction.set(targetProfileRef, { ...targetProfile, followersCount: counts.targetFollowersCount });
    if (following) {
      transaction.set(followingRef, { uid: targetUid, createdAt: now });
      transaction.set(followerRef, { uid: callerUid, createdAt: now });
    } else {
      transaction.delete(followingRef);
      transaction.delete(followerRef);
    }
    return { following, idempotent: false, callerDisplayName, followEventAtMs: following ? now.toMillis() : null, ...counts };
  });
  const { callerDisplayName, followEventAtMs, ...publicResult } = result;
  if (following) {
    try {
      await createTrustedNotification(db, targetUid, {
        id: notificationEventId("follow", callerUid, followEventAtMs || "existing"),
        type: "follow",
        actorUid: callerUid,
        metadata: {
          actorName: callerDisplayName || request.auth.token.name || "A GM",
          route: `/profile/${callerUid}`,
        },
      });
    } catch (error) {
      console.error("Follow notification delivery failed.", { targetUid, callerUid, error: error.message });
    }
  }
  return publicResult;
}

export const followUser = onCall((request) => mutateFollow(request, true));
export const unfollowUser = onCall((request) => mutateFollow(request, false));

export const syncNbaPlayerCatalog = onCall({ secrets: [balldontlieApiKey], timeoutSeconds: 1800, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Catalog administrator access is required.");
  try { return await runNbaCatalogSync({ db, apiKey: balldontlieApiKey.value() }); }
  catch (error) { throw new HttpsError("internal", `NBA catalog sync failed: ${error.message}`); }
});

const catalogPublicationError = (error) => {
  if (error instanceof HttpsError) return error;
  const code = error?.code === "permission-denied" ? "permission-denied" : /unavailable|not found/i.test(error?.message || "") ? "not-found" : /immutable|already|validation|required|preview|review|confirmation|critical|stale|revoked|unsupported|count|not ready|transition|basis/i.test(error?.message || "") ? "failed-precondition" : "internal";
  return new HttpsError(code, error?.message || "Catalog publication failed.");
};

export const publishPlayerCatalog = onCall({ timeoutSeconds: 900, memory: "1GiB" }, async (request) => {
  try { return await publishRatingsPreview({ db, auth: request.auth, ...(request.data || {}) }); }
  catch (error) { throw catalogPublicationError(error); }
});

export const rollbackPlayerCatalogVersion = onCall(async (request) => {
  try { return await rollbackPlayerCatalog({ db, auth: request.auth, ...(request.data || {}) }); }
  catch (error) { throw catalogPublicationError(error); }
});

export const approveRatingsCalibrationReview = onCall(async (request) => {
  try { return await approveCalibrationReview({ db, auth: request.auth, importId: request.data?.importId, input: request.data || {} }); }
  catch (error) { throw catalogPublicationError(error); }
});

export const revokeRatingsCalibrationReview = onCall(async (request) => {
  try { return await revokeCalibrationReview({ db, auth: request.auth, importId: request.data?.importId, input: request.data || {} }); }
  catch (error) { throw catalogPublicationError(error); }
});

export const setRatingsLicensingReview = onCall(async (request) => {
  try { return await setLicensingReview({ db, auth: request.auth, importId: request.data?.importId, input: request.data || {} }); }
  catch (error) { throw catalogPublicationError(error); }
});

export const initializeLeagueContracts = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can initialize league contracts.");
    if (!["season_ready", "regular_season", "playoffs", "offseason"].includes(league.status)) throw new HttpsError("failed-precondition", "Complete the draft before initializing contracts.");
    const [teamsSnapshot, contractsSnapshot] = await Promise.all([
      transaction.get(leagueRef.collection("teams")),
      transaction.get(leagueRef.collection("contracts")),
    ]);
    const teams = teamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    const rosterSize = normalizeRosterConfig(league).rosterSize;
    if (teams.length !== league.memberIds?.length || teams.some((team) => !Array.isArray(team.roster) || team.roster.length !== rosterSize)) throw new HttpsError("failed-precondition", `Every franchise needs its drafted ${rosterSize}-player roster.`);
    let creates;
    try {
      creates = initializeMissingContracts({ league, teams, existingContracts: contractsSnapshot.docs.map((snapshot) => snapshot.data()) });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    const now = Timestamp.now();
    creates.forEach((contract) => transaction.create(leagueRef.collection("contracts").doc(String(contract.playerId)), { ...contract, createdAt: now, updatedAt: now }));
    if (league.contractVersion !== 1) transaction.update(leagueRef, { contractVersion: 1, contractsInitializedAt: now, updatedAt: now });
    return { initialized: creates.length, alreadyInitialized: creates.length === 0 && league.contractVersion === 1 };
  });
});

const DRAFT_LINEUP_POSITIONS = ["PG", "SG", "SF", "PF", "C"];

function draftPlayerSnapshot(snapshot, capturedAt) {
  const player = { id: snapshot.id, ...snapshot.data() };
  return buildLeaguePlayerSnapshot(player, capturedAt);
}

function normalizedDraftLineup(roster, lineup = {}) {
  const ids = new Set(roster.map((player) => String(player.id)));
  return Object.fromEntries(DRAFT_LINEUP_POSITIONS.map((position) => [position, ids.has(String(lineup[position])) ? lineup[position] : null]));
}

function drafterForPick(order, round, pickInRound) {
  return order[round % 2 === 1 ? pickInRound - 1 : order.length - pickInRound];
}

async function commitTrustedDraftSelection({ transaction, leagueRef, draftRef, teamRef, ownershipRef, pickRef, leagueId, league, draft, team, player, selectionType, now }) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const rosterSize = normalizeRosterConfig(league).rosterSize;
  if (draft.totalRounds !== rosterSize || roster.length >= rosterSize) throw new HttpsError("failed-precondition", `This ${rosterSize}-player roster is already complete.`);
  if (roster.some((member) => String(member.id) === String(player.id))) throw new HttpsError("already-exists", "This player is already on the roster.");
  const nextRoster = [...roster, player];
  const feasibility = getDraftRosterFeasibility(nextRoster, rosterSize);
  if (!feasibility.canStillBecomeValid) throw new HttpsError("failed-precondition", `This pick would leave too few roster slots to cover ${feasibility.uncoveredPositions.join(", ")}.`);
  const nextPicksMade = draft.picksMade + 1;
  const completed = nextPicksMade === draft.draftOrder.length * draft.totalRounds;
  if (completed && !feasibility.valid) throw new HttpsError("failed-precondition", "A completed Draft roster must support PG, SG, SF, PF, and C with unique players.");
  if (completed) {
    const otherTeamSnapshots = await Promise.all(league.memberIds.filter((uid) => uid !== draft.currentDrafterUid).map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))));
    if (otherTeamSnapshots.some((snapshot) => !snapshot.exists || snapshot.data().roster?.length !== rosterSize || !canBuildLegalStartingFive(snapshot.data().roster).valid)) throw new HttpsError("failed-precondition", "Every completed Draft roster must support a legal Starting Five.");
  }
  let nextRound = draft.currentRound;
  let nextPickInRound = draft.currentPickInRound;
  let nextDrafterUid = null;
  if (!completed) {
    if (draft.currentPickInRound === draft.draftOrder.length) { nextRound += 1; nextPickInRound = 1; }
    else nextPickInRound += 1;
    nextDrafterUid = drafterForPick(draft.draftOrder, nextRound, nextPickInRound);
  }
  const nextWindow = completed ? null : buildDraftTurnWindow(now.toMillis());
  const lastPick = { playerId: player.id, ownerUid: draft.currentDrafterUid, overallPick: draft.currentPickNumber, round: draft.currentRound, pickInRound: draft.currentPickInRound, selectionType, pickedAt: now };
  transaction.update(teamRef, { roster: nextRoster, lineup: normalizedDraftLineup(nextRoster, team.lineup), updatedAt: now });
  transaction.create(ownershipRef, { playerId: player.id, ownerUid: draft.currentDrafterUid, teamId: draft.currentDrafterUid, updatedAt: now });
  transaction.create(pickRef, { leagueId, playerId: player.id, player, ownerUid: draft.currentDrafterUid, overallPick: draft.currentPickNumber, round: draft.currentRound, pickInRound: draft.currentPickInRound, selectionType, pickedAt: now });
  transaction.update(draftRef, { status: completed ? "completed" : "active", currentRound: nextRound, currentPickInRound: nextPickInRound, currentPickNumber: completed ? draft.currentPickNumber : draft.currentPickNumber + 1, currentDrafterUid: nextDrafterUid, picksMade: nextPicksMade, lastPick, pickStartedAt: completed ? null : Timestamp.fromMillis(nextWindow.pickStartedAtMs), pickDeadlineAt: completed ? null : Timestamp.fromMillis(nextWindow.pickDeadlineAtMs), updatedAt: now, completedAt: completed ? now : null });
  if (completed) transaction.update(leagueRef, { status: "season_ready", updatedAt: now });
  return { playerId: player.id, rosterCount: nextRoster.length, completed, feasibility, selectionType };
}

export const makeDraftPick = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, playerId: rawPlayerId } = request.data || {};
  if (typeof leagueId !== "string" || (typeof rawPlayerId !== "string" && typeof rawPlayerId !== "number")) throw new HttpsError("invalid-argument", "A league and player are required.");
  const userId = request.auth.uid;
  const playerId = String(rawPlayerId);
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const catalogLeagueSnapshot = await leagueRef.get();
  if (!catalogLeagueSnapshot.exists) throw new HttpsError("not-found", "The shared league is unavailable.");
  const draftRef = leagueRef.collection("draft").doc("state");
  const teamRef = leagueRef.collection("teams").doc(userId);
  const ownershipRef = leagueRef.collection("playerOwnership").doc(playerId);
  const playerRef = db.doc(`${catalogPlayersPath(catalogLeagueSnapshot.data())}/${playerId}`);
  const pickRef = draftRef.collection("picks").doc(playerId);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, draftSnapshot, teamSnapshot, ownershipSnapshot, playerSnapshot, pickSnapshot] = await Promise.all([
      transaction.get(leagueRef), transaction.get(draftRef), transaction.get(teamRef), transaction.get(ownershipRef), transaction.get(playerRef), transaction.get(pickRef),
    ]);
    if (!leagueSnapshot.exists || !draftSnapshot.exists) throw new HttpsError("not-found", "The shared league draft is unavailable.");
    const league = leagueSnapshot.data();
    const draft = draftSnapshot.data();
    if (league.status !== "drafting" || draft.status !== "active") throw new HttpsError("failed-precondition", "This draft is no longer active.");
    if (!league.memberIds?.includes(userId) || draft.currentDrafterUid !== userId) throw new HttpsError("permission-denied", "Wait for your turn before making a pick.");
    const now = Timestamp.now();
    if (!draft.pickDeadlineAt) throw new HttpsError("failed-precondition", "The trusted pick timer is still initializing.");
    if (isDraftTurnExpired(draft.pickDeadlineAt, now.toMillis())) throw new HttpsError("deadline-exceeded", "This pick has expired and is being auto-selected.");
    if (!teamSnapshot.exists) throw new HttpsError("failed-precondition", "Your league franchise is unavailable.");
    if (!playerSnapshot.exists) throw new HttpsError("not-found", "This player is not in the canonical catalog.");
    if (ownershipSnapshot.exists || pickSnapshot.exists) throw new HttpsError("already-exists", "This player has already been drafted.");
    const catalogPlayer = playerSnapshot.data();
    if (catalogPlayer.active !== true || catalogPlayer.draftEligible !== true || String(catalogPlayer.id) !== playerId) throw new HttpsError("failed-precondition", "This player is not eligible for the shared draft.");
    const player = draftPlayerSnapshot(playerSnapshot, now);
    return commitTrustedDraftSelection({ transaction, leagueRef, draftRef, teamRef, ownershipRef, pickRef, leagueId, league, draft, team: teamSnapshot.data(), player, selectionType: "manual", now });
  });
});

function expectedDraftTurn(data = {}) {
  return {
    pickNumber: data.pickNumber,
    drafterUid: data.drafterUid,
    deadlineMs: data.deadlineMs,
  };
}

async function enqueueDraftExpiration(leagueId, draft) {
  if (draft.status !== "active" || !draft.pickDeadlineAt) return;
  const queue = getFunctions().taskQueue("resolveExpiredDraftPickTask");
  await queue.enqueue(
    { leagueId, expectedTurn: draftTurnIdentity(draft) },
    { scheduleTime: draft.pickDeadlineAt.toDate() },
  );
}

export const initializeDraftPickTimer = onDocumentCreated("leagues/{leagueId}/draft/state", async (event) => {
  const draftRef = event.data?.ref;
  if (!draftRef) return;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(draftRef);
    if (!snapshot.exists || snapshot.data().status !== "active" || snapshot.data().pickDeadlineAt) return;
    const now = Timestamp.now();
    const window = buildDraftTurnWindow(now.toMillis());
    transaction.update(draftRef, { pickStartedAt: now, pickDeadlineAt: Timestamp.fromMillis(window.pickDeadlineAtMs), updatedAt: now });
  });
});

async function notifyDraftTurn(leagueId, draft) {
  if (draft?.status !== "active" || !draft.currentDrafterUid || !Number.isInteger(draft.currentPickNumber)) return;
  const leagueSnapshot = await db.doc(`leagues/${leagueId}`).get();
  if (!leagueSnapshot.exists || leagueSnapshot.data().status !== "drafting") return;
  const league = leagueSnapshot.data();
  await createTrustedNotification(db, draft.currentDrafterUid, {
    id: notificationEventId("draft", leagueId, league.season || 1, draft.currentPickNumber),
    type: "draft_turn",
    actorUid: null,
    metadata: {
      leagueId,
      leagueName: league.name || "Your league",
      season: league.season || 1,
      round: draft.currentRound,
      pickNumber: draft.currentPickNumber,
      route: "/league/draft",
    },
  });
}

export const produceInitialDraftTurnNotification = onDocumentCreated({ document: "leagues/{leagueId}/draft/state", retry: true }, async (event) => {
  await notifyDraftTurn(event.params.leagueId, event.data?.data());
});

export const produceDraftTurnNotification = onDocumentUpdated({ document: "leagues/{leagueId}/draft/state", retry: true }, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after || (before?.currentPickNumber === after.currentPickNumber && before?.currentDrafterUid === after.currentDrafterUid)) return;
  await notifyDraftTurn(event.params.leagueId, after);
});

export const produceLeagueMemberActivity = onDocumentCreated({ document: "leagues/{leagueId}/members/{memberUid}", retry: true }, async (event) => {
  const member = event.data?.data();
  if (!member) return;
  const { leagueId, memberUid } = event.params;
  const createdLeague = member.role === "commissioner";
  await createTrustedLeagueActivity(db, leagueId, {
    id: activityEventId(createdLeague ? "league-created" : "member-joined", memberUid),
    type: createdLeague ? "league_created" : "member_joined",
    actorUid: memberUid,
    createdAt: member.joinedAt || null,
    metadata: { actorName: member.displayName || "A GM" },
  });
});

export const produceDraftPickActivity = onDocumentCreated({ document: "leagues/{leagueId}/draft/state/picks/{pickId}", retry: true }, async (event) => {
  const pick = event.data?.data();
  if (!pick) return;
  const { leagueId } = event.params;
  const [member, team] = await Promise.all([
    db.doc(`leagues/${leagueId}/members/${pick.ownerUid}`).get(),
    db.doc(`leagues/${leagueId}/teams/${pick.ownerUid}`).get(),
  ]);
  await createTrustedLeagueActivity(db, leagueId, {
    id: activityEventId("draft-pick", pick.overallPick),
    type: "player_drafted",
    actorUid: pick.ownerUid,
    createdAt: pick.pickedAt || null,
    targetUid: null,
    metadata: {
      actorName: member.data()?.displayName || team.data()?.name || "A GM",
      teamName: team.data()?.name || null,
      playerId: String(pick.playerId),
      playerName: pick.player?.name || "a player",
      overallPick: pick.overallPick,
      round: pick.round,
    },
  });
});

export const scheduleDraftPickExpiration = onDocumentUpdated("leagues/{leagueId}/draft/state", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!after?.pickDeadlineAt || after.status !== "active" || before?.pickDeadlineAt?.toMillis?.() === after.pickDeadlineAt.toMillis()) return;
  await enqueueDraftExpiration(event.params.leagueId, after);
});

export const syncDraftClock = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const draftRef = leagueRef.collection("draft").doc("state");
  const result = await db.runTransaction(async (transaction) => {
    const [leagueSnapshot, draftSnapshot] = await Promise.all([transaction.get(leagueRef), transaction.get(draftRef)]);
    if (!leagueSnapshot.exists || !draftSnapshot.exists || !leagueSnapshot.data().memberIds?.includes(request.auth.uid)) throw new HttpsError("permission-denied", "Draft membership is required.");
    const now = Timestamp.now();
    const draft = draftSnapshot.data();
    if (draft.status === "active" && !draft.pickDeadlineAt) {
      const window = buildDraftTurnWindow(now.toMillis());
      transaction.update(draftRef, { pickStartedAt: now, pickDeadlineAt: Timestamp.fromMillis(window.pickDeadlineAtMs), updatedAt: now });
    }
    return { serverNowMs: now.toMillis() };
  });
  return result;
});

async function resolveExpiredDraft({ leagueId, expectedTurn, requesterUid = null }) {
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const catalogLeagueSnapshot = await leagueRef.get();
  if (!catalogLeagueSnapshot.exists) throw new HttpsError("not-found", "The shared Draft is unavailable.");
  const catalogSnapshot = await db.collection(catalogPlayersPath(catalogLeagueSnapshot.data())).where("active", "==", true).where("draftEligible", "==", true).get();
  const catalogCandidates = catalogSnapshot.docs.map((snapshot) => ({ snapshot, player: { id: snapshot.id, ...snapshot.data() } }));
  const draftRef = leagueRef.collection("draft").doc("state");
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, draftSnapshot, ownershipSnapshot, picksSnapshot] = await Promise.all([
      transaction.get(leagueRef), transaction.get(draftRef), transaction.get(leagueRef.collection("playerOwnership")), transaction.get(draftRef.collection("picks")),
    ]);
    if (!leagueSnapshot.exists || !draftSnapshot.exists) throw new HttpsError("not-found", "The shared Draft is unavailable.");
    const league = leagueSnapshot.data();
    const draft = draftSnapshot.data();
    if (requesterUid && !league.memberIds?.includes(requesterUid)) throw new HttpsError("permission-denied", "Draft membership is required.");
    if (draft.status !== "active" || league.status !== "drafting") return { alreadyResolved: true };
    if (expectedTurn && !draftTurnMatches(draft, expectedTurn)) return { alreadyResolved: true, staleTurn: true };
    const now = Timestamp.now();
    if (!isDraftTurnExpired(draft.pickDeadlineAt, now.toMillis())) throw new HttpsError("failed-precondition", "The current Draft pick has not expired.");
    const teamRef = leagueRef.collection("teams").doc(draft.currentDrafterUid);
    const teamSnapshot = await transaction.get(teamRef);
    if (!teamSnapshot.exists) throw new HttpsError("failed-precondition", "The current franchise is unavailable.");
    const rosterSize = normalizeRosterConfig(league).rosterSize;
    const ownedPlayerIds = new Set([...ownershipSnapshot.docs.map((snapshot) => snapshot.id), ...picksSnapshot.docs.map((snapshot) => snapshot.id)]);
    const selected = selectDeterministicAutoPick({ candidates: catalogCandidates.map(({ player }) => player), roster: teamSnapshot.data().roster || [], rosterSize, ownedPlayerIds });
    if (!selected) throw new HttpsError("failed-precondition", "No valid automatic Draft selection is available.");
    const selectedCatalog = catalogCandidates.find(({ player }) => String(player.id) === String(selected.player.id));
    const selectedSnapshot = await transaction.get(selectedCatalog.snapshot.ref);
    if (!selectedSnapshot.exists || selectedSnapshot.data().active !== true || selectedSnapshot.data().draftEligible !== true) throw new HttpsError("aborted", "The selected catalog player changed; retry automatic selection.");
    const ownershipRef = leagueRef.collection("playerOwnership").doc(selectedSnapshot.id);
    const pickRef = draftRef.collection("picks").doc(selectedSnapshot.id);
    const [ownershipExact, pickExact] = await Promise.all([transaction.get(ownershipRef), transaction.get(pickRef)]);
    if (ownershipExact.exists || pickExact.exists) throw new HttpsError("aborted", "The selected player was claimed; retry automatic selection.");
    return commitTrustedDraftSelection({ transaction, leagueRef, draftRef, teamRef, ownershipRef, pickRef, leagueId, league, draft, team: teamSnapshot.data(), player: draftPlayerSnapshot(selectedSnapshot, now), selectionType: "auto", now });
  });
}

export const resolveExpiredDraftPick = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, expectedTurn } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  return resolveExpiredDraft({ leagueId, expectedTurn: expectedDraftTurn(expectedTurn), requesterUid: request.auth.uid });
});

export const resolveExpiredDraftPickTask = onTaskDispatched(
  { retryConfig: { maxAttempts: 5, minBackoffSeconds: 2 } },
  async (request) => resolveExpiredDraft(request.data || {}),
);

export const repairPreseasonRoster = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, dropPlayerId: rawDropId, addPlayerId: rawAddId } = request.data || {};
  if (typeof leagueId !== "string" || rawDropId == null || rawAddId == null) throw new HttpsError("invalid-argument", "A league, outgoing player, and incoming player are required.");
  const actorUid = request.auth.uid;
  const dropPlayerId = String(rawDropId);
  const addPlayerId = String(rawAddId);
  if (dropPlayerId === addPlayerId) throw new HttpsError("invalid-argument", "Choose two different players.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const catalogLeagueSnapshot = await leagueRef.get();
  if (!catalogLeagueSnapshot.exists) throw new HttpsError("not-found", "Your league is unavailable.");
  const teamRef = leagueRef.collection("teams").doc(actorUid);
  const dropOwnershipRef = leagueRef.collection("playerOwnership").doc(dropPlayerId);
  const addOwnershipRef = leagueRef.collection("playerOwnership").doc(addPlayerId);
  const dropContractRef = leagueRef.collection("contracts").doc(dropPlayerId);
  const addContractRef = leagueRef.collection("contracts").doc(addPlayerId);
  const addPlayerRef = db.doc(`${catalogPlayersPath(catalogLeagueSnapshot.data())}/${addPlayerId}`);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, teamSnapshot, dropOwnership, addOwnership, addPlayerSnapshot, dropContract, addContract, contractsSnapshot] = await Promise.all([
      transaction.get(leagueRef), transaction.get(teamRef), transaction.get(dropOwnershipRef), transaction.get(addOwnershipRef), transaction.get(addPlayerRef), transaction.get(dropContractRef), transaction.get(addContractRef), transaction.get(leagueRef.collection("contracts")),
    ]);
    if (!leagueSnapshot.exists || !teamSnapshot.exists) throw new HttpsError("not-found", "Your league franchise is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    const team = { id: teamSnapshot.id, ...teamSnapshot.data() };
    if (!addPlayerSnapshot.exists) throw new HttpsError("not-found", "The incoming canonical player is unavailable.");
    const canonical = addPlayerSnapshot.data();
    if (String(canonical.id) !== addPlayerId) throw new HttpsError("failed-precondition", "The incoming canonical player identity is invalid.");
    const incoming = draftPlayerSnapshot(addPlayerSnapshot, Timestamp.now());
    incoming.active = canonical.active;
    incoming.draftEligible = canonical.draftEligible;
    let repair;
    try {
      repair = buildPreseasonRosterRepair({ league, team, actorUid, dropPlayerId, incomingPlayer: incoming, dropOwnershipOwnerUid: dropOwnership.exists ? dropOwnership.data().ownerUid : null, addOwnershipExists: addOwnership.exists, contracts: contractsSnapshot.docs.map((snapshot) => snapshot.data()), dropContract: dropContract.exists ? dropContract.data() : null, addContractExists: addContract.exists });
    } catch (error) {
      throw new HttpsError(/owner|membership|owned by/i.test(error.message) ? "permission-denied" : /no longer available/i.test(error.message) ? "already-exists" : "failed-precondition", error.message);
    }
    const now = Timestamp.now();
    if (repair.newContract) {
      transaction.delete(dropContractRef);
      transaction.create(addContractRef, { ...repair.newContract, createdAt: now, updatedAt: now });
    }
    transaction.update(teamRef, { roster: repair.roster.map(({ active: _active, draftEligible: _draftEligible, ...player }) => player), lineup: repair.lineup, updatedAt: now });
    transaction.delete(dropOwnershipRef);
    transaction.create(addOwnershipRef, { playerId: incoming.id, ownerUid: actorUid, teamId: actorUid, updatedAt: now });
    transaction.update(leagueRef, { seasonReadyMemberIds: repair.readyMemberIds, updatedAt: now });
    return { droppedPlayerId: dropPlayerId, addedPlayerId: incoming.id, feasibility: repair.feasibility };
  });
});

function freeAgencyError(error) {
  const codes = {
    "member-required": "permission-denied",
    "team-required": "permission-denied",
    "ownership-conflict": "permission-denied",
    "player-ineligible": "failed-precondition",
    "player-owned": "already-exists",
    "contract-conflict": "failed-precondition",
    "player-not-rostered": "not-found",
    "contracts-invalid": "failed-precondition",
    "roster-full": "failed-precondition",
    "over-cap": "failed-precondition",
    "offseason-required": "failed-precondition",
  };
  return new HttpsError(codes[error?.code] || "failed-precondition", error?.message || "Free Agency could not be updated.");
}

function validateFreeAgencyRequest(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, playerId } = request.data || {};
  if (typeof leagueId !== "string" || !leagueId || (typeof playerId !== "string" && typeof playerId !== "number")) {
    throw new HttpsError("invalid-argument", "A league and player are required.");
  }
  return { leagueId, playerId: String(playerId), actorUid: request.auth.uid };
}

export const signFreeAgent = onCall(async (request) => {
  const { leagueId, playerId, actorUid } = validateFreeAgencyRequest(request);
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const catalogLeagueSnapshot = await leagueRef.get();
  if (!catalogLeagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
  const teamRef = leagueRef.collection("teams").doc(actorUid);
  const ownershipRef = leagueRef.collection("playerOwnership").doc(playerId);
  const contractRef = leagueRef.collection("contracts").doc(playerId);
  const playerRef = db.doc(`${catalogPlayersPath(catalogLeagueSnapshot.data())}/${playerId}`);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, teamSnapshot, playerSnapshot, ownershipSnapshot, contractSnapshot, contractsSnapshot] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(teamRef),
      transaction.get(playerRef),
      transaction.get(ownershipRef),
      transaction.get(contractRef),
      transaction.get(leagueRef.collection("contracts")),
    ]);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    if (!teamSnapshot.exists) throw new HttpsError("failed-precondition", "Your franchise team is unavailable.");
    if (!playerSnapshot.exists) throw new HttpsError("not-found", "This canonical player is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    const team = { id: teamSnapshot.id, ...teamSnapshot.data() };
    const { catalogOrder: _catalogOrder, ...canonicalPlayer } = { id: playerSnapshot.id, ...playerSnapshot.data() };
    const now = Timestamp.now();
    const rosterPlayer = buildLeaguePlayerSnapshot(canonicalPlayer, now);
    let signing;
    try {
      signing = buildFreeAgentSigning({
        league,
        team,
        contracts: contractsSnapshot.docs.map((snapshot) => snapshot.data()),
        player: canonicalPlayer,
        rosterPlayer,
        actorUid,
        ownershipExists: ownershipSnapshot.exists,
        contractExists: contractSnapshot.exists,
      });
    } catch (error) {
      throw freeAgencyError(error);
    }
    transaction.update(teamRef, { roster: signing.roster, lineup: signing.lineup, updatedAt: now });
    transaction.create(ownershipRef, { playerId: canonicalPlayer.id, ownerUid: actorUid, teamId: actorUid, updatedAt: now });
    transaction.create(contractRef, { ...signing.contract, createdAt: now, updatedAt: now });
    transaction.update(leagueRef, {
      offseason: { ...league.offseason, readyMemberIds: signing.readyMemberIds },
      updatedAt: now,
    });
    return { playerId: canonicalPlayer.id, rosterCount: signing.roster.length, salary: signing.contract.salary, yearsRemaining: signing.contract.yearsRemaining };
  });
});

export const releasePlayer = onCall(async (request) => {
  const { leagueId, playerId, actorUid } = validateFreeAgencyRequest(request);
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const teamRef = leagueRef.collection("teams").doc(actorUid);
  const ownershipRef = leagueRef.collection("playerOwnership").doc(playerId);
  const contractRef = leagueRef.collection("contracts").doc(playerId);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, teamSnapshot, ownershipSnapshot, contractSnapshot] = await Promise.all([
      transaction.get(leagueRef), transaction.get(teamRef), transaction.get(ownershipRef), transaction.get(contractRef),
    ]);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    if (!teamSnapshot.exists) throw new HttpsError("failed-precondition", "Your franchise team is unavailable.");
    if (!ownershipSnapshot.exists || !contractSnapshot.exists) throw new HttpsError("failed-precondition", "Player ownership and contract records are required.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    const team = { id: teamSnapshot.id, ...teamSnapshot.data() };
    let release;
    try {
      release = buildPlayerRelease({ league, team, contract: contractSnapshot.data(), playerId, actorUid, ownershipOwnerUid: ownershipSnapshot.data().ownerUid });
    } catch (error) {
      throw freeAgencyError(error);
    }
    const now = Timestamp.now();
    transaction.update(teamRef, { roster: release.roster, lineup: release.lineup, updatedAt: now });
    transaction.delete(ownershipRef);
    transaction.delete(contractRef);
    transaction.update(leagueRef, {
      offseason: { ...league.offseason, readyMemberIds: release.readyMemberIds },
      updatedAt: now,
    });
    return { playerId, rosterCount: release.roster.length };
  });
});

function buildStartedGame(game, homeTeam, awayTeam, startedAt, rosterSize = 5, league = {}) {
  const window = buildPresentationWindow(startedAt.toMillis());
  return buildOfficialGameActivation({
    game,
    homeTeam,
    awayTeam,
    startedAt,
    endsAt: Timestamp.fromMillis(window.endsAtMs),
    rosterSize,
    league,
  });
}

async function enqueuePresentationFinalization(game) {
  const queue = getFunctions().taskQueue("finalizeOfficialGameTask");
  await queue.enqueue(
    { leagueId: game.leagueId, gameId: game.id },
    { scheduleTime: game.endsAt.toDate() },
  );
}

export const scheduleOfficialGameFinalization = onDocumentUpdated(
  "leagues/{leagueId}/games/{gameId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.status === "in_progress" || after?.status !== "in_progress" || !after.presentation?.endsAt) return;
    await enqueuePresentationFinalization({ leagueId: event.params.leagueId, id: event.params.gameId, endsAt: after.presentation.endsAt });
  },
);

export const initializePlayoffs = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leagueRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...snapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can initialize playoffs.");
    let initialization;
    try { initialization = buildPlayoffInitialization(league); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
    if (initialization.alreadyInitialized) return initialization;
    const now = Timestamp.now();
    initialization.games.forEach((game) => transaction.create(leagueRef.collection("games").doc(game.id), { ...game, createdAt: now, updatedAt: now }));
    transaction.update(leagueRef, { status: "playoffs", postseason: { ...initialization.postseason, initializedAt: now }, updatedAt: now });
    return { ...initialization, games: initialization.games.map((game) => game.id) };
  });
});

export const startPlayoffRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const started = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leagueRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = snapshot.data();
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can start playoff rounds.");
    if (league.status !== "playoffs" || !["semifinals", "finals"].includes(league.postseason?.status)) throw new HttpsError("failed-precondition", "No playoff round is eligible.");
    const ids = league.postseason.status === "semifinals" ? league.postseason.games.semifinals : [league.postseason.games.final];
    const gameSnapshots = await Promise.all(ids.map((id) => transaction.get(leagueRef.collection("games").doc(id))));
    if (gameSnapshots.some((game) => !game.exists || game.data().status !== "scheduled")) throw new HttpsError("failed-precondition", "This playoff round has already started or is incomplete.");
    const teamIds = [...new Set(gameSnapshots.flatMap((game) => [game.data().homeUid, game.data().awayUid]))];
    const teamSnapshots = await Promise.all(teamIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))));
    if (teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Every playoff franchise must exist.");
    const teams = new Map(teamSnapshots.map((team) => [team.id, team.data()]));
    const now = Timestamp.now();
    const tasks = gameSnapshots.map((snapshot) => {
      const game = { id: snapshot.id, ...snapshot.data() };
      let update;
      try { update = buildStartedGame(game, teams.get(game.homeUid), teams.get(game.awayUid), now, normalizeRosterConfig(league).rosterSize, league); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      transaction.update(snapshot.ref, update);
      return { leagueId, id: game.id, endsAt: update.presentation.endsAt };
    });
    transaction.update(leagueRef, { postseason: { ...league.postseason, roundStartedAt: now }, updatedAt: now });
    return { status: league.postseason.status, games: ids, tasks };
  });
  return { status: started.status, games: started.games };
});

export const startRegularSeasonRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") {
    throw new HttpsError("invalid-argument", "A league is required.");
  }
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const started = await db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    if (league.commissionerUid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the commissioner can start a round.");
    }
    if (league.status !== "regular_season") {
      throw new HttpsError("failed-precondition", "The regular season is not active.");
    }
    let progress = league.seasonProgress;
    let legacyGameDocs = null;
    if (!progress) {
      const allGamesSnapshot = await transaction.get(leagueRef.collection("games"));
      legacyGameDocs = allGamesSnapshot.docs;
      const totalRounds = league.schedule?.totalRounds;
      if (!Number.isInteger(totalRounds) || totalRounds < 1) {
        throw new HttpsError("failed-precondition", "This season has invalid schedule metadata.");
      }
      const firstIncompleteRound = Array.from({ length: totalRounds }, (_, index) => index + 1)
        .find((roundNumber) => legacyGameDocs.some(
          (snapshot) => snapshot.data().round === roundNumber && snapshot.data().status !== "completed",
        ));
      if (!firstIncompleteRound) {
        const now = Timestamp.now();
        transaction.update(leagueRef, {
          seasonProgress: {
            ...createSeasonProgress(totalRounds),
            currentRound: totalRounds,
            roundStatus: ROUND_STATUS.COMPLETED,
            regularSeasonComplete: true,
          },
          updatedAt: now,
        });
        return { alreadyStarted: true, currentRound: totalRounds, regularSeasonComplete: true };
      }
      const currentGames = legacyGameDocs.filter(
        (snapshot) => snapshot.data().round === firstIncompleteRound,
      );
      if (currentGames.some((snapshot) => snapshot.data().status === "in_progress")) {
        const now = Timestamp.now();
        transaction.update(leagueRef, {
          seasonProgress: {
            ...createSeasonProgress(totalRounds),
            currentRound: firstIncompleteRound,
            roundStatus: ROUND_STATUS.ACTIVE,
            roundStartedAt: now,
          },
          updatedAt: now,
        });
        return { alreadyStarted: true, currentRound: firstIncompleteRound };
      }
      progress = {
        ...createSeasonProgress(totalRounds),
        currentRound: firstIncompleteRound,
      };
    }
    if (progress.roundStatus === ROUND_STATUS.ACTIVE) {
      return { alreadyStarted: true, currentRound: progress.currentRound };
    }
    if (progress.roundStatus === ROUND_STATUS.COMPLETED && progress.currentRound > 0) {
      const previousRoundSnapshot = legacyGameDocs
        ? { docs: legacyGameDocs.filter((snapshot) => snapshot.data().round === progress.currentRound) }
        : { docs: (await transaction.get(leagueRef.collection("games").where("season", "==", league.season))).docs.filter((snapshot) => snapshot.data().round === progress.currentRound) };
      if (!isRoundProgressionComplete(previousRoundSnapshot.docs.map((snapshot) => snapshot.data()))) {
        throw new HttpsError("failed-precondition", "Waiting for every live game presentation to finish.");
      }
    }
    const round = nextRoundToStart(progress);
    if (!round) {
      throw new HttpsError("failed-precondition", "The next round is not eligible yet.");
    }
    const gamesSnapshot = legacyGameDocs
      ? { docs: legacyGameDocs.filter((snapshot) => snapshot.data().round === round) }
      : { docs: (await transaction.get(leagueRef.collection("games").where("season", "==", league.season))).docs.filter((snapshot) => snapshot.data().round === round) };
    const expectedGames = league.memberIds.length / 2;
    if (gamesSnapshot.docs.length !== expectedGames) {
      throw new HttpsError("failed-precondition", "The current round schedule is incomplete.");
    }
    const games = gamesSnapshot.docs.map((snapshot) => ({ ref: snapshot.ref, ...snapshot.data() }));
    if (games.some((game) => !["scheduled", "ready"].includes(game.status))) {
      throw new HttpsError("failed-precondition", "Every game in this round must still be scheduled.");
    }
    if (games.some((game) => game.leagueId !== leagueId || game.season !== league.season || game.round !== round)) {
      throw new HttpsError("failed-precondition", "A scheduled game identity is invalid.");
    }
    const teamIds = [...new Set(games.flatMap((game) => [game.homeUid, game.awayUid]))];
    const teamSnapshots = await Promise.all(teamIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))));
    if (teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Every scheduled franchise must exist.");
    const teams = new Map(teamSnapshots.map((team) => [team.id, team.data()]));
    const now = Timestamp.now();
    const tasks = games.map((game) => {
      let update;
      try { update = buildStartedGame({ ...game, id: game.ref.id }, teams.get(game.homeUid), teams.get(game.awayUid), now, normalizeRosterConfig(league).rosterSize, league); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      transaction.update(game.ref, update);
      return { leagueId, id: game.ref.id, endsAt: update.presentation.endsAt };
    });
    transaction.update(leagueRef, {
      seasonProgress: {
        ...progress,
        currentRound: round,
        roundStatus: ROUND_STATUS.ACTIVE,
        regularSeasonComplete: false,
        roundStartedAt: now,
      },
      updatedAt: now,
    });
    return { alreadyStarted: false, currentRound: round, tasks };
  });
  return { alreadyStarted: started.alreadyStarted, currentRound: started.currentRound, regularSeasonComplete: started.regularSeasonComplete };
});

export const completeOfficialGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, gameId } = request.data || {};
  if (typeof leagueId !== "string" || typeof gameId !== "string") {
    throw new HttpsError("invalid-argument", "A league and game are required.");
  }

  const leagueRef = db.doc(`leagues/${leagueId}`);
  const gameRef = leagueRef.collection("games").doc(gameId);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    const gameSnapshot = await transaction.get(gameRef);
    if (!leagueSnapshot.exists || !gameSnapshot.exists) {
      throw new HttpsError("not-found", "This official game is unavailable.");
    }

    const league = leagueSnapshot.data();
    const game = gameSnapshot.data();
    if (![game.homeUid, game.awayUid].includes(request.auth.uid)) {
      throw new HttpsError("permission-denied", "Only scheduled participants can run this game.");
    }
    const isPlayoffGame = game.stage === "semifinal" || game.stage === "final";
    if ((!isPlayoffGame && league.status !== "regular_season") || (isPlayoffGame && league.status !== "playoffs")) throw new HttpsError("failed-precondition", "This official game is not active in the current league phase.");
    if (game.leagueId !== leagueId || game.season !== league.season) {
      throw new HttpsError("failed-precondition", "The scheduled game identity is invalid.");
    }

    const homeRef = leagueRef.collection("teams").doc(game.homeUid);
    const awayRef = leagueRef.collection("teams").doc(game.awayUid);
    const [homeSnapshot, awaySnapshot] = await Promise.all([
      transaction.get(homeRef),
      transaction.get(awayRef),
    ]);
    if (!homeSnapshot.exists || !awaySnapshot.exists) {
      throw new HttpsError("failed-precondition", "Both scheduled franchises must exist.");
    }
    const homeTeam = homeSnapshot.data();
    const awayTeam = awaySnapshot.data();
    if (homeTeam.ownerUid !== game.homeUid || awayTeam.ownerUid !== game.awayUid) {
      throw new HttpsError("failed-precondition", "Scheduled participants no longer match their franchises.");
    }

    if (game.status === "completed") {
      return {
        alreadyCompleted: true,
        result: game.result,
        boxScore: game.boxScore,
        timeline: game.timeline,
        presentation: game.presentation,
      };
    }
    if (game.status !== "in_progress") {
      throw new HttpsError("failed-precondition", "Start this official game before simulating it.");
    }
    if (game.timeline?.length && game.result && game.presentation) {
      return { alreadyGenerated: true, result: game.result, boxScore: game.boxScore, timeline: game.timeline, presentation: game.presentation };
    }
    throw new HttpsError("failed-precondition", "This game was not initialized by its trusted round start.");
  });
});

async function finalizePresentation({ leagueId, gameId, participantUid = null }) {
  if (typeof leagueId !== "string" || typeof gameId !== "string") throw new HttpsError("invalid-argument", "A league and game are required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const gameRef = leagueRef.collection("games").doc(gameId);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, gameSnapshot] = await Promise.all([transaction.get(leagueRef), transaction.get(gameRef)]);
    if (!leagueSnapshot.exists || !gameSnapshot.exists) throw new HttpsError("not-found", "This official game is unavailable.");
    const league = leagueSnapshot.data();
    const game = gameSnapshot.data();
    if (participantUid && ![game.homeUid, game.awayUid].includes(participantUid)) throw new HttpsError("permission-denied", "Only scheduled participants can finalize this presentation.");
    const isPlayoffGame = ["semifinal", "final"].includes(game.stage);
    if ((!isPlayoffGame && league.status !== "regular_season") || (isPlayoffGame && league.status !== "playoffs")) throw new HttpsError("failed-precondition", "This official game is not active in the current league phase.");
    if (game.leagueId !== leagueId || game.season !== league.season) throw new HttpsError("failed-precondition", "The scheduled game identity is invalid.");
    if (game.status === "completed") return { alreadyCompleted: true };
    if (game.status !== "in_progress" || !game.result || !game.timeline?.length || !game.presentation?.endsAt) throw new HttpsError("failed-precondition", "The trusted presentation is not ready to finalize.");
    const now = Timestamp.now();
    if (!isPresentationDeadlineReached(game.presentation, now.toMillis())) throw new HttpsError("failed-precondition", "The live presentation is still in progress.");
    const homeRef = leagueRef.collection("teams").doc(game.homeUid);
    const awayRef = leagueRef.collection("teams").doc(game.awayUid);
    const [homeSnapshot, awaySnapshot] = await Promise.all([transaction.get(homeRef), transaction.get(awayRef)]);
    if (!homeSnapshot.exists || !awaySnapshot.exists) throw new HttpsError("failed-precondition", "Both franchises must exist.");
    const seasonGamesSnapshot = (!isPlayoffGame || game.stage === "semifinal") ? await transaction.get(leagueRef.collection("games").where("season", "==", league.season)) : null;
    const roundSnapshot = isPlayoffGame ? null : { docs: seasonGamesSnapshot.docs.filter((snapshot) => snapshot.data().round === game.round) };
    const semifinalSnapshot = game.stage === "semifinal" ? { docs: seasonGamesSnapshot.docs.filter((snapshot) => snapshot.data().stage === "semifinal") } : null;
    const projectedGame = { id: gameId, ...game, status: "completed", presentationCompletedAt: now };
    const progress = league.seasonProgress;
    const roundComplete = !isPlayoffGame && isRoundProgressionComplete(roundSnapshot.docs.map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() }));
    const finalSeasonGame = roundComplete && game.round === progress?.totalRounds;
    const allGamesSnapshot = finalSeasonGame ? await transaction.get(leagueRef.collection("games")) : null;
    const allTeamsSnapshot = finalSeasonGame ? await transaction.get(leagueRef.collection("teams")) : null;
    transaction.update(gameRef, { status: "completed", presentationCompletedAt: now, completedAt: now, updatedAt: now });
    if (!isPlayoffGame) {
      const records = buildOfficialCompletion({ game, homeTeam: homeSnapshot.data(), awayTeam: awaySnapshot.data(), simulation: { result: game.result, boxScore: game.boxScore, timeline: game.timeline } });
      transaction.update(homeRef, { record: records.homeRecord, updatedAt: now });
      transaction.update(awayRef, { record: records.awayRecord, updatedAt: now });
      if (roundComplete) {
        const completedProgress = { ...progress, roundStatus: ROUND_STATUS.COMPLETED, regularSeasonComplete: finalSeasonGame, roundCompletedAt: now };
        const finalization = finalSeasonGame ? buildRegularSeasonFinalization({
          league: { ...league, seasonProgress: completedProgress },
          teams: allTeamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
          games: allGamesSnapshot.docs.map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() }),
          completedAt: now,
        }) : null;
        transaction.update(leagueRef, { seasonProgress: completedProgress, ...(finalization ? { regularSeasonResult: finalization.regularSeasonResult, postseason: finalization.postseason } : {}), updatedAt: now });
      }
    } else if (game.stage === "semifinal") {
      const semifinals = semifinalSnapshot.docs.filter((snapshot) => snapshot.data().season === league.season).map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() });
      if (semifinals.length === 2 && semifinals.every(isGameProgressionComplete)) {
        const finalGame = buildFinalMatchup({ id: leagueId, ...league }, semifinals);
        transaction.create(leagueRef.collection("games").doc(finalGame.id), { ...finalGame, createdAt: now, updatedAt: now });
        transaction.update(leagueRef, { postseason: { ...league.postseason, status: "finals", games: { ...league.postseason.games, final: finalGame.id }, semifinalsCompletedAt: now }, updatedAt: now });
      }
    } else {
      const championship = buildChampionship(league.postseason, projectedGame, now);
      transaction.update(leagueRef, { postseason: championship.postseason, updatedAt: now });
    }
    return { alreadyCompleted: false, completedAt: now };
  });
}

export const finalizeOfficialGamePresentation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return finalizePresentation({ ...(request.data || {}), participantUid: request.auth.uid });
});

export const finalizeOfficialGameTask = onTaskDispatched(
  { retryConfig: { maxAttempts: 5, minBackoffSeconds: 5 } },
  async (request) => {
    await finalizePresentation(request.data || {});
  },
);

export const produceOfficialGameResultNotifications = onDocumentUpdated({ document: "leagues/{leagueId}/games/{gameId}", retry: true }, async (event) => {
  const before = event.data?.before.data();
  const game = event.data?.after.data();
  if (!game || before?.status === "completed" || game.status !== "completed" || !game.result?.winnerUid || !game.result?.loserUid || !game.presentationCompletedAt) return;
  const { leagueId, gameId } = event.params;
  const score = `${game.result.homeScore}-${game.result.awayScore}`;
  await createTrustedNotifications(db, [game.homeUid, game.awayUid], (uid) => {
    const won = uid === game.result.winnerUid;
    const opponentUid = uid === game.homeUid ? game.awayUid : game.homeUid;
    const opponentName = uid === game.homeUid ? game.awayTeamName : game.homeTeamName;
    return {
      id: notificationEventId("game-result", leagueId, gameId),
      type: "game_result",
      actorUid: opponentUid,
      metadata: {
        leagueId,
        gameId,
        season: game.season,
        round: game.round || null,
        stage: game.stage || "regular_season",
        outcome: won ? "win" : "loss",
        opponentName: opponentName || "your opponent",
        score,
        route: "/games",
      },
    };
  });
});

export const produceLeagueLifecycleNotifications = onDocumentUpdated({ document: "leagues/{leagueId}", retry: true }, async (event) => {
  const before = event.data?.before.data();
  const league = event.data?.after.data();
  if (!before || !league) return;
  const { leagueId } = event.params;
  const jobs = [];
  const beforeProgress = before.seasonProgress;
  const progress = league.seasonProgress;
  let readyRound = null;
  if (before.status !== "regular_season" && league.status === "regular_season" && progress?.roundStatus === ROUND_STATUS.PENDING) readyRound = progress.currentRound;
  else if (beforeProgress?.roundStatus !== ROUND_STATUS.COMPLETED && progress?.roundStatus === ROUND_STATUS.COMPLETED && progress.currentRound < progress.totalRounds) readyRound = progress.currentRound + 1;
  if (readyRound) {
    jobs.push(createTrustedNotifications(db, league.memberIds, {
      id: notificationEventId("round-ready", leagueId, league.season, readyRound),
      type: "round_ready",
      actorUid: null,
      metadata: { leagueId, leagueName: league.name || "Your league", season: league.season, round: readyRound, route: "/games" },
    }));
  }

  const previousQualifierUids = new Set((before.postseason?.qualifiers || []).map((team) => team.uid));
  for (const qualifier of league.postseason?.qualifiers || []) {
    if (previousQualifierUids.has(qualifier.uid)) continue;
    jobs.push(createTrustedNotification(db, qualifier.uid, {
      id: notificationEventId("playoff-qualified", leagueId, league.season, qualifier.uid),
      type: "playoff_qualified",
      actorUid: null,
      metadata: { leagueId, leagueName: league.name || "Your league", season: league.season, seed: qualifier.seed, teamName: qualifier.teamName, route: "/playoffs" },
    }));
  }

  const champion = league.postseason?.champion;
  if (champion?.uid && before.postseason?.champion?.uid !== champion.uid && league.postseason?.status === "completed") {
    jobs.push(createTrustedNotification(db, champion.uid, {
      id: notificationEventId("champion", leagueId, league.season, champion.uid),
      type: "champion",
      actorUid: null,
      metadata: { leagueId, leagueName: league.name || "Your league", season: league.season, teamName: champion.teamName, route: "/playoffs" },
    }));
  }
  if (before.status !== "offseason" && league.status === "offseason") jobs.push(createTrustedNotifications(db, league.memberIds, {
    id: notificationEventId("offseason-started", leagueId, league.season), type: "league_lifecycle", actorUid: league.commissionerUid || null,
    metadata: { leagueId, leagueName: league.name || "Your league", season: league.season, event: "offseason_started", route: `/league/${leagueId}` },
  }));
  if (before.status === "offseason" && league.status === "season_ready" && league.season === before.season + 1) jobs.push(createTrustedNotifications(db, league.memberIds, {
    id: notificationEventId("next-season-started", leagueId, league.season), type: "league_lifecycle", actorUid: league.commissionerUid || null,
    metadata: { leagueId, leagueName: league.name || "Your league", season: league.season, event: "next_season_started", route: `/league/${leagueId}` },
  }));
  await Promise.all(jobs);
});

export const produceLeagueLifecycleActivity = onDocumentUpdated({ document: "leagues/{leagueId}", retry: true }, async (event) => {
  const before = event.data?.before.data();
  const league = event.data?.after.data();
  if (!before || !league) return;
  const { leagueId } = event.params;
  const jobs = [];
  const base = { actorUid: league.commissionerUid || null, targetUid: null, gameId: null };
  if (before.status !== "drafting" && league.status === "drafting") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("draft-started", league.season), type: "draft_started", createdAt: league.draftStartedAt || null, metadata: { season: league.season },
  }));
  if (before.status === "drafting" && league.status === "season_ready") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("draft-completed", league.season), type: "draft_completed", createdAt: league.updatedAt || null, metadata: { season: league.season },
  }));
  if (before.seasonProgress?.roundStatus !== ROUND_STATUS.ACTIVE && league.seasonProgress?.roundStatus === ROUND_STATUS.ACTIVE) jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("round-started", league.season, league.seasonProgress.currentRound), type: "round_started", createdAt: league.seasonProgress.roundStartedAt || league.updatedAt || null, metadata: { season: league.season, round: league.seasonProgress.currentRound },
  }));
  if (before.status !== "playoffs" && league.status === "playoffs") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("playoffs-started", league.season), type: "playoffs_started", createdAt: league.postseason?.startedAt || league.updatedAt || null, metadata: { season: league.season },
  }));
  const champion = league.postseason?.champion;
  if (champion?.uid && before.postseason?.champion?.uid !== champion.uid && league.postseason?.status === "completed") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    id: activityEventId("champion-crowned", league.season), type: "champion_crowned", actorUid: champion.uid, targetUid: null, gameId: league.postseason?.games?.final || null,
    createdAt: league.postseason?.completedAt || null, metadata: { season: league.season, teamName: champion.teamName || "The champion" },
  }));
  if (champion?.uid && before.postseason?.status !== "completed" && league.postseason?.status === "completed") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("season-completed", league.season), type: "season_completed", createdAt: league.postseason.completedAt || league.updatedAt || null, metadata: { season: league.season, championName: champion.teamName || "The champion" },
  }));
  if (before.status !== "offseason" && league.status === "offseason") jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("offseason-started", league.season), type: "offseason_started", createdAt: league.offseason?.startedAt || league.updatedAt || null, metadata: { season: league.season, nextSeason: league.offseason?.nextSeason },
  }));
  if (before.status === "offseason" && league.status === "season_ready" && league.season === before.season + 1) jobs.push(createTrustedLeagueActivity(db, leagueId, {
    ...base, id: activityEventId("next-season-started", league.season), type: "next_season_started", createdAt: league.seasonTransition?.completedAt || league.updatedAt || null, metadata: { season: league.season },
  }));
  await Promise.all(jobs);
});

export const produceOfficialGameActivity = onDocumentUpdated({ document: "leagues/{leagueId}/games/{gameId}", retry: true }, async (event) => {
  const before = event.data?.before.data();
  const game = event.data?.after.data();
  if (!game || before?.status === "completed" || game.status !== "completed" || !game.result?.winnerUid || !game.presentationCompletedAt) return;
  const { leagueId, gameId } = event.params;
  const winnerName = game.result.winnerUid === game.homeUid ? game.homeTeamName : game.awayTeamName;
  const loserName = game.result.loserUid === game.homeUid ? game.homeTeamName : game.awayTeamName;
  await createTrustedLeagueActivity(db, leagueId, {
    id: activityEventId("game-finished", gameId), type: "game_finished", actorUid: game.result.winnerUid, targetUid: game.result.loserUid, gameId,
    createdAt: game.presentationCompletedAt || game.completedAt || null, metadata: { season: game.season, round: game.round || null, stage: game.stage || "regular_season", winnerName: winnerName || "The winner", loserName: loserName || "the opponent", homeScore: game.result.homeScore, awayScore: game.result.awayScore, route: "/games" },
  });
});

async function produceRosterMovementActivity(event, type) {
  const ownership = event.data?.data();
  if (!ownership?.ownerUid) return;
  const { leagueId, playerId } = event.params;
  const league = await db.doc(`leagues/${leagueId}`).get();
  if (!league.exists || league.data().status !== "offseason") return;
  const [member, team, player] = await Promise.all([
    db.doc(`leagues/${leagueId}/members/${ownership.ownerUid}`).get(),
    db.doc(`leagues/${leagueId}/teams/${ownership.ownerUid}`).get(),
    db.doc(`${catalogPlayersPath(league.data())}/${playerId}`).get(),
  ]);
  const signed = type === "free_agent_signed";
  await createTrustedLeagueActivity(db, leagueId, {
    id: activityEventId(signed ? "free-agent-signed" : "player-released", league.data().season, ownership.ownerUid, playerId, ownership.updatedAt?.toMillis?.() || "legacy"),
    type, actorUid: ownership.ownerUid, targetUid: null, gameId: null, createdAt: ownership.updatedAt || null,
    metadata: { actorName: member.data()?.displayName || "A GM", teamName: team.data()?.name || null, playerId: String(playerId), playerName: player.data()?.name || "a player" },
  });
}

export const produceFreeAgentSigningActivity = onDocumentCreated({ document: "leagues/{leagueId}/playerOwnership/{playerId}", retry: true }, (event) => produceRosterMovementActivity(event, "free_agent_signed"));
export const producePlayerReleaseActivity = onDocumentDeleted({ document: "leagues/{leagueId}/playerOwnership/{playerId}", retry: true }, (event) => produceRosterMovementActivity(event, "player_released"));

async function reconcileExpiredContracts(transaction, leagueRef, league, contractsSnapshot, now) {
  if (!contractsSnapshot) return { released: 0, readyMemberIds: league.offseason?.readyMemberIds || [] };
  const agedContracts = contractsSnapshot.docs.map((snapshot) => {
    try { return { snapshot, contract: ageContractForSeason(snapshot.data(), league.season) }; }
    catch (error) { throw new HttpsError("failed-precondition", error.message); }
  });
  const expired = agedContracts.filter(({ contract }) => contract.yearsRemaining === 0);
  const teamsSnapshot = await transaction.get(leagueRef.collection("teams"));
  const ownershipSnapshots = await Promise.all(expired.map(({ contract }) => transaction.get(leagueRef.collection("playerOwnership").doc(String(contract.playerId)))));
  const teamUpdates = new Map();
  const releasedOwners = new Set();
  expired.forEach(({ snapshot, contract }, index) => {
    const teamSnapshot = teamsSnapshot.docs.find((item) => item.id === contract.ownerUid);
    if (teamSnapshot) {
      const team = teamUpdates.get(contract.ownerUid) || teamSnapshot.data();
      const key = String(contract.playerId);
      const roster = (team.roster || []).filter((player) => String(player.id) !== key);
      const lineup = Object.fromEntries(Object.entries(team.lineup || {}).map(([position, assignedId]) => [position, String(assignedId) === key ? null : assignedId]));
      teamUpdates.set(contract.ownerUid, { ...team, roster, lineup });
      releasedOwners.add(contract.ownerUid);
    }
    const ownershipSnapshot = ownershipSnapshots[index];
    if (ownershipSnapshot.exists && ownershipSnapshot.data().ownerUid === contract.ownerUid) transaction.delete(ownershipSnapshot.ref);
    transaction.delete(snapshot.ref);
  });
  agedContracts.filter(({ contract }) => contract.yearsRemaining > 0).forEach(({ snapshot, contract }) => {
    if (contract.lastAgedSeason !== snapshot.data().lastAgedSeason) transaction.update(snapshot.ref, { yearsRemaining: contract.yearsRemaining, lastAgedSeason: contract.lastAgedSeason, updatedAt: now });
  });
  teamUpdates.forEach((team, uid) => transaction.update(leagueRef.collection("teams").doc(uid), { roster: team.roster, lineup: team.lineup, updatedAt: now }));
  return {
    released: expired.length,
    readyMemberIds: (league.offseason?.readyMemberIds || []).filter((uid) => !releasedOwners.has(uid)),
  };
}

export const enterOffseason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can enter offseason.");
    if (!["playoffs", "offseason"].includes(league.status)) throw new HttpsError("failed-precondition", "The league is not ready for offseason.");
    if (!Number.isInteger(league.season) || league.season < 1) throw new HttpsError("failed-precondition", "The active season number is invalid.");
    if (league.status === "offseason") {
      if (league.contractVersion !== 1) return { alreadyFinalized: true, season: league.season, expiredPlayersReleased: 0 };
      const contractsSnapshot = await transaction.get(leagueRef.collection("contracts"));
      const now = Timestamp.now();
      const cleanup = await reconcileExpiredContracts(transaction, leagueRef, league, contractsSnapshot, now);
      if (cleanup.released) transaction.update(leagueRef, { offseason: { ...league.offseason, readyMemberIds: cleanup.readyMemberIds }, updatedAt: now });
      return { alreadyFinalized: true, season: league.season, expiredPlayersReleased: cleanup.released };
    }
    const historyRef = leagueRef.collection("seasons").doc(String(league.season));
    const playoffIds = [...(league.postseason?.games?.semifinals || []), league.postseason?.games?.final].filter(Boolean);
    const readPromises = [
      transaction.get(historyRef),
      ...playoffIds.map((id) => transaction.get(leagueRef.collection("games").doc(id))),
    ];
    if (league.contractVersion === 1) readPromises.push(transaction.get(leagueRef.collection("contracts")));
    const readSnapshots = await Promise.all(readPromises);
    const historySnapshot = readSnapshots[0];
    const gameSnapshots = readSnapshots.slice(1, 1 + playoffIds.length);
    const contractsSnapshot = league.contractVersion === 1 ? readSnapshots.at(-1) : null;
    if (!playoffIds.length || gameSnapshots.some((snapshot) => !snapshot.exists)) throw new HttpsError("failed-precondition", "The trusted playoff bracket is incomplete.");
    let history;
    try {
      history = buildSeasonHistory({
        league: { ...league, status: "playoffs" },
        playoffGames: gameSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    if (historySnapshot.exists && !seasonHistoryMatches(historySnapshot.data(), history)) throw new HttpsError("already-exists", "A conflicting completed season history already exists.");
    const now = Timestamp.now();
    const cleanup = await reconcileExpiredContracts(transaction, leagueRef, league, contractsSnapshot, now);
    if (!historySnapshot.exists) transaction.create(historyRef, { ...history, createdAt: now });
    transaction.update(leagueRef, buildOffseasonTransition(league, now));
    return { alreadyFinalized: historySnapshot.exists, season: league.season, expiredPlayersReleased: cleanup.released };
  });
});

export const leaveLeagueDynasty = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const actorUid = request.auth.uid;
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const result = await db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    if (!league.memberIds?.includes(actorUid)) return { alreadyLeft: true, season: league.season };
    const permission = canLeaveLeagueDynasty(league, actorUid);
    if (!permission.allowed) {
      const messages = {
        OFFSEASON_REQUIRED: "You can leave this league during the offseason.",
        COMMISSIONER_TRANSFER_REQUIRED: "The commissioner must archive the league or transfer authority before leaving.",
      };
      throw new HttpsError(permission.reason === "NOT_MEMBER" ? "permission-denied" : "failed-precondition", messages[permission.reason] || "League departure is unavailable.");
    }
    const memberRef = leagueRef.collection("members").doc(actorUid);
    const teamRef = leagueRef.collection("teams").doc(actorUid);
    const userRef = db.doc(`users/${actorUid}`);
    const [memberSnapshot, teamSnapshot, userSnapshot, contractsSnapshot, ownershipSnapshot] = await Promise.all([
      transaction.get(memberRef), transaction.get(teamRef), transaction.get(userRef),
      transaction.get(leagueRef.collection("contracts").where("ownerUid", "==", actorUid)),
      transaction.get(leagueRef.collection("playerOwnership").where("ownerUid", "==", actorUid)),
    ]);
    const now = Timestamp.now();
    transaction.update(leagueRef, buildDepartingMemberUpdate(league, actorUid, now));
    if (memberSnapshot.exists) transaction.delete(memberRef);
    if (teamSnapshot.exists) transaction.delete(teamRef);
    contractsSnapshot.docs.forEach((snapshot) => transaction.delete(snapshot.ref));
    ownershipSnapshot.docs.forEach((snapshot) => transaction.delete(snapshot.ref));
    if (userSnapshot.exists && userSnapshot.data().activeLeagueId === leagueId) transaction.update(userRef, { activeLeagueId: null, updatedAt: now });
    return { alreadyLeft: false, season: league.season, releasedPlayers: ownershipSnapshot.size };
  });
  if (!result.alreadyLeft) {
    try {
      await createTrustedLeagueActivity(db, leagueId, { id: activityEventId("member-left", request.auth.uid, result.season), type: "member_left", actorUid: request.auth.uid, createdAt: Timestamp.now(), metadata: { season: result.season } });
    } catch (error) { console.error("Member-left activity delivery failed.", { leagueId, actorUid, error: error.message }); }
  }
  return result;
});

export const archiveLeague = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const actorUid = request.auth.uid;
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const result = await db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    const permission = canArchiveLeague(league, actorUid);
    if (!permission.allowed) throw new HttpsError(permission.reason === "COMMISSIONER_REQUIRED" ? "permission-denied" : "failed-precondition", permission.reason === "OFFSEASON_REQUIRED" ? "A league can only be archived during offseason." : "Only the commissioner can archive this league.");
    if (permission.alreadyArchived) return { alreadyArchived: true, season: league.season, memberIds: league.memberIds || [] };
    const userSnapshots = await Promise.all((league.memberIds || []).map((uid) => transaction.get(db.doc(`users/${uid}`))));
    const now = Timestamp.now();
    transaction.update(leagueRef, buildArchiveUpdate(league, actorUid, now));
    userSnapshots.forEach((snapshot) => {
      if (snapshot.exists && snapshot.data().activeLeagueId === leagueId) transaction.update(snapshot.ref, { activeLeagueId: null, updatedAt: now });
    });
    return { alreadyArchived: false, season: league.season, memberIds: league.memberIds || [] };
  });
  if (!result.alreadyArchived) {
    try {
      await createTrustedLeagueActivity(db, leagueId, { id: activityEventId("league-archived", result.season), type: "league_archived", actorUid, createdAt: Timestamp.now(), metadata: { season: result.season } });
    } catch (error) { console.error("League-archive activity delivery failed.", { leagueId, error: error.message }); }
    try {
      await createTrustedNotifications(db, result.memberIds, { id: notificationEventId("league-archived", leagueId, result.season), type: "league_lifecycle", actorUid, metadata: { leagueId, season: result.season, event: "league_archived", route: `/league/${leagueId}` } });
    } catch (error) { console.error("League-archive notification delivery failed.", { leagueId, error: error.message }); }
  }
  return { alreadyArchived: result.alreadyArchived, season: result.season };
});

export const startNextSeason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (!isNextSeasonCommissioner(league, request.auth.uid)) throw new HttpsError("permission-denied", "Only the commissioner can start the next season.");
    if (isNextSeasonTransitionRetry(league)) return { alreadyStarted: true, season: league.season };
    if (league.status !== "offseason") throw new HttpsError("failed-precondition", "The league is not in offseason.");
    const historyRef = leagueRef.collection("seasons").doc(String(league.season));
    const nextSeasonReads = [
      transaction.get(historyRef),
      ...league.memberIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))),
    ];
    if (league.contractVersion === 1) nextSeasonReads.push(transaction.get(leagueRef.collection("contracts")));
    const nextSeasonSnapshots = await Promise.all(nextSeasonReads);
    const historySnapshot = nextSeasonSnapshots[0];
    const teamSnapshots = nextSeasonSnapshots.slice(1, 1 + league.memberIds.length);
    const contractsSnapshot = league.contractVersion === 1 ? nextSeasonSnapshots.at(-1) : null;
    if (!historySnapshot.exists || teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Completed history and every franchise are required.");
    if (contractsSnapshot) {
      const contracts = contractsSnapshot.docs.map((snapshot) => snapshot.data());
      const invalidTeam = teamSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })).find((team) => !validateTeamContracts(team, contracts, league).valid);
      if (invalidTeam) throw new HttpsError("failed-precondition", "Every franchise must have valid contracts and remain under the salary cap.");
    }
    const now = Timestamp.now();
    let transition;
    try {
      transition = buildNextSeasonTransition({
        league,
        history: historySnapshot.data(),
        teams: teamSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        transitionedAt: now,
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    const leagueUpdate = { ...transition.leagueUpdate };
    transition.fieldsToClear.forEach((field) => { leagueUpdate[field] = FieldValue.delete(); });
    transaction.update(leagueRef, leagueUpdate);
    transition.teamUpdates.forEach((team) => transaction.update(leagueRef.collection("teams").doc(team.uid), { record: team.record, updatedAt: now }));
    return { alreadyStarted: false, season: transition.targetSeason };
  });
});

export const finalizeRegularSeason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    if (!league.memberIds?.includes(request.auth.uid)) {
      throw new HttpsError("permission-denied", "League membership is required.");
    }
    if (league.regularSeasonResult) {
      return { alreadyFinalized: true, regularSeasonResult: league.regularSeasonResult, postseason: league.postseason };
    }
    const [gamesSnapshot, teamsSnapshot] = await Promise.all([
      transaction.get(leagueRef.collection("games")),
      transaction.get(leagueRef.collection("teams")),
    ]);
    const now = Timestamp.now();
    let finalization;
    try {
      finalization = buildRegularSeasonFinalization({
        league,
        teams: teamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        games: gamesSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        completedAt: now,
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    transaction.update(leagueRef, {
      regularSeasonResult: finalization.regularSeasonResult,
      postseason: finalization.postseason,
      updatedAt: now,
    });
    return finalization;
  });
});
