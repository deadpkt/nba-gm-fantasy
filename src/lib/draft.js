import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { functions } from "./firebaseFunctions";
import { LEAGUE_STATUS } from "./leagueStatuses";
import { LEGACY_ROSTER_SIZE, normalizeRosterConfig } from "./rosterConfig";

export const DRAFT_STATUS = Object.freeze({
  ACTIVE: "active",
  COMPLETED: "completed",
});

export const draftStateRef = (leagueId) =>
  doc(db, "leagues", leagueId, "draft", "state");

export const draftPicksRef = (leagueId) =>
  collection(db, "leagues", leagueId, "draft", "state", "picks");

export function getDrafterForPick(draftOrder, round, pickInRound) {
  const index =
    round % 2 === 1
      ? pickInRound - 1
      : draftOrder.length - pickInRound;
  return draftOrder[index];
}

export function buildInitialDraftState(leagueId, draftOrder, totalRounds = LEGACY_ROSTER_SIZE) {
  if (!draftOrder.length) throw new Error("A draft requires league members.");
  return {
    leagueId,
    status: DRAFT_STATUS.ACTIVE,
    draftOrder,
    currentRound: 1,
    currentPickInRound: 1,
    currentPickNumber: 1,
    currentDrafterUid: draftOrder[0],
    picksMade: 0,
    totalRounds,
    lastPick: null,
    pickStartedAt: null,
    pickDeadlineAt: null,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  };
}

export async function initializeLeagueDraft({ leagueId, userId }) {
  const leagueRef = doc(db, "leagues", leagueId);
  const stateRef = draftStateRef(leagueId);

  await runTransaction(db, async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists()) throw new Error("This league is unavailable.");
    const league = leagueSnapshot.data();
    if (league.status !== LEAGUE_STATUS.DRAFTING) {
      throw new Error("The league is not in the drafting phase.");
    }
    if (league.commissionerUid !== userId) {
      throw new Error("Only the commissioner can initialize the draft.");
    }

    const [stateSnapshot, ...teamSnapshots] = await Promise.all([
      transaction.get(stateRef),
      ...league.memberIds.map((memberId) =>
        transaction.get(doc(db, "leagues", leagueId, "teams", memberId)),
      ),
    ]);
    if (stateSnapshot.exists()) return;
    if (
      teamSnapshots.some(
        (snapshot) =>
          !snapshot.exists() || (snapshot.data().roster || []).length !== 0,
      )
    ) {
      throw new Error(
        "Every franchise roster must be empty before the shared draft initializes.",
      );
    }
    transaction.set(
      stateRef,
      buildInitialDraftState(leagueId, [...league.memberIds], normalizeRosterConfig(league).rosterSize),
    );
  });
}

export async function makeDraftPick({ leagueId, userId, playerId }) {
  if (!functions || !userId) throw new Error("Trusted Draft services are unavailable.");
  return (await httpsCallable(functions, "makeDraftPick")({ leagueId, playerId: String(playerId) })).data;
}

export async function syncTrustedDraftClock({ leagueId }) {
  if (!functions) throw new Error("Trusted Draft services are unavailable.");
  const requestedAt = Date.now();
  const result = (await httpsCallable(functions, "syncDraftClock")({ leagueId })).data;
  const receivedAt = Date.now();
  return { ...result, offsetMs: result.serverNowMs - Math.round((requestedAt + receivedAt) / 2) };
}

export async function resolveExpiredDraftPick({ leagueId, expectedTurn }) {
  if (!functions) throw new Error("Trusted Draft services are unavailable.");
  return (await httpsCallable(functions, "resolveExpiredDraftPick")({ leagueId, expectedTurn })).data;
}
