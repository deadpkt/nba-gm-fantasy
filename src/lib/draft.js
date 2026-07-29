import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { normalizeLeagueLineup } from "./leagueTeams";
import { db } from "./firebase";
import { LEAGUE_STATUS } from "./leagueStatuses";
import { playerOwnershipRef } from "./playerOwnership";

export const DRAFT_STATUS = Object.freeze({
  ACTIVE: "active",
  COMPLETED: "completed",
});

export const DRAFT_ROUNDS = 5;

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

export function buildInitialDraftState(leagueId, draftOrder) {
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
    totalRounds: DRAFT_ROUNDS,
    lastPick: null,
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
      buildInitialDraftState(leagueId, [...league.memberIds]),
    );
  });
}

function canonicalPlayerSnapshot(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    overall: player.overall,
    image: player.image,
    color: player.color || null,
    stats: player.stats,
  };
}

export async function makeDraftPick({ leagueId, userId, playerId }) {
  const leagueRef = doc(db, "leagues", leagueId);
  const stateRef = draftStateRef(leagueId);
  const teamRef = doc(db, "leagues", leagueId, "teams", userId);
  const ownershipRef = playerOwnershipRef(leagueId, playerId);
  const playerRef = doc(
    db,
    "playerCatalogs",
    "current",
    "players",
    String(playerId),
  );
  const pickRef = doc(draftPicksRef(leagueId), String(playerId));

  await runTransaction(db, async (transaction) => {
    const [
      leagueSnapshot,
      draftSnapshot,
      teamSnapshot,
      ownershipSnapshot,
      playerSnapshot,
      existingPickSnapshot,
    ] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(stateRef),
      transaction.get(teamRef),
      transaction.get(ownershipRef),
      transaction.get(playerRef),
      transaction.get(pickRef),
    ]);

    if (!leagueSnapshot.exists() || !draftSnapshot.exists()) {
      throw new Error("The shared league draft is unavailable.");
    }
    if (leagueSnapshot.data().status !== LEAGUE_STATUS.DRAFTING) {
      throw new Error("The league is not in the drafting phase.");
    }

    const draft = draftSnapshot.data();
    if (draft.status !== DRAFT_STATUS.ACTIVE) {
      throw new Error("This draft is no longer active.");
    }
    if (draft.currentDrafterUid !== userId) {
      throw new Error("Wait for your turn before making a pick.");
    }
    if (!teamSnapshot.exists()) {
      throw new Error("Your league franchise is unavailable.");
    }
    if (!playerSnapshot.exists()) {
      throw new Error(
        "This player is not in the published Firestore draft catalog.",
      );
    }
    if (ownershipSnapshot.exists() || existingPickSnapshot.exists()) {
      throw new Error("This player has already been drafted.");
    }

    const team = teamSnapshot.data();
    const roster = Array.isArray(team.roster) ? team.roster : [];
    if (roster.length >= DRAFT_ROUNDS) {
      throw new Error("Your five-player roster is already complete.");
    }

    const player = canonicalPlayerSnapshot(playerSnapshot.data());
    if (String(player.id) !== String(playerId)) {
      throw new Error("The selected player catalog entry is invalid.");
    }
    if (roster.some((member) => String(member.id) === String(player.id))) {
      throw new Error("This player is already on your roster.");
    }

    const nextPicksMade = draft.picksMade + 1;
    const totalPicks = draft.draftOrder.length * draft.totalRounds;
    const completed = nextPicksMade === totalPicks;
    let nextRound = draft.currentRound;
    let nextPickInRound = draft.currentPickInRound;
    let nextDrafterUid = null;

    if (!completed) {
      if (draft.currentPickInRound === draft.draftOrder.length) {
        nextRound += 1;
        nextPickInRound = 1;
      } else {
        nextPickInRound += 1;
      }
      nextDrafterUid = getDrafterForPick(
        draft.draftOrder,
        nextRound,
        nextPickInRound,
      );
    }

    const lastPick = {
      playerId: player.id,
      ownerUid: userId,
      overallPick: draft.currentPickNumber,
      round: draft.currentRound,
      pickInRound: draft.currentPickInRound,
      pickedAt: serverTimestamp(),
    };

    transaction.update(teamRef, {
      roster: [...roster, player],
      lineup: normalizeLeagueLineup([...roster, player], team.lineup),
      updatedAt: serverTimestamp(),
    });
    transaction.set(ownershipRef, {
      playerId: player.id,
      ownerUid: userId,
      teamId: userId,
      updatedAt: serverTimestamp(),
    });
    transaction.set(pickRef, {
      leagueId,
      playerId: player.id,
      player,
      ownerUid: userId,
      overallPick: draft.currentPickNumber,
      round: draft.currentRound,
      pickInRound: draft.currentPickInRound,
      pickedAt: serverTimestamp(),
    });
    transaction.update(stateRef, {
      status: completed ? DRAFT_STATUS.COMPLETED : DRAFT_STATUS.ACTIVE,
      currentRound: nextRound,
      currentPickInRound: nextPickInRound,
      currentPickNumber: completed
        ? draft.currentPickNumber
        : draft.currentPickNumber + 1,
      currentDrafterUid: nextDrafterUid,
      picksMade: nextPicksMade,
      lastPick,
      updatedAt: serverTimestamp(),
      completedAt: completed ? serverTimestamp() : null,
    });

    if (completed) {
      transaction.update(leagueRef, {
        status: LEAGUE_STATUS.SEASON_READY,
        updatedAt: serverTimestamp(),
      });
    }
  });
}
