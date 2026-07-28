import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

function requirePlayerId(playerId) {
  if (playerId === undefined || playerId === null || playerId === "") {
    throw new Error("A player ID is required to manage league ownership.");
  }
}

export function playerOwnershipRef(leagueId, playerId) {
  requirePlayerId(playerId);
  return doc(db, "leagues", leagueId, "playerOwnership", String(playerId));
}

export async function claimLeaguePlayerOwnership(
  transaction,
  leagueId,
  playerId,
  ownerUid,
) {
  const ownershipRef = playerOwnershipRef(leagueId, playerId);
  const ownershipSnapshot = await transaction.get(ownershipRef);
  if (ownershipSnapshot.exists()) {
    throw new Error("This player is already owned by another franchise.");
  }

  transaction.set(ownershipRef, {
    playerId,
    ownerUid,
    teamId: ownerUid,
    updatedAt: serverTimestamp(),
  });
}

export async function releaseLeaguePlayerOwnership(
  transaction,
  leagueId,
  playerId,
  ownerUid,
) {
  const ownershipRef = playerOwnershipRef(leagueId, playerId);
  const ownershipSnapshot = await transaction.get(ownershipRef);
  if (ownershipSnapshot.exists() && ownershipSnapshot.data().ownerUid === ownerUid) {
    transaction.delete(ownershipRef);
  }
}
