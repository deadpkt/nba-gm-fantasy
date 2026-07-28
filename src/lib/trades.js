import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { playerOwnershipRef } from "./playerOwnership";

const playerKey = (playerId) => String(playerId);

function uniquePlayerIds(playerIds, label) {
  if (!Array.isArray(playerIds) || !playerIds.length) {
    throw new Error(`${label} must include at least one player.`);
  }
  const ids = playerIds.map(playerKey);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} cannot include the same player twice.`);
  }
  return ids;
}

function playerSnapshot(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    overall: player.overall,
    image: player.image || null,
    color: player.color || null,
  };
}

function playersForIds(roster, playerIds, label) {
  const rosterById = new Map(roster.map((player) => [playerKey(player.id), player]));
  const players = playerIds.map((playerId) => rosterById.get(playerId));
  if (players.some((player) => !player)) {
    throw new Error(`${label} includes a player who is no longer on that roster.`);
  }
  return players;
}

export async function createTradeOffer({
  leagueId,
  senderUid,
  receiverUid,
  offeredPlayerIds,
  requestedPlayerIds,
}) {
  if (!leagueId || !senderUid || !receiverUid || senderUid === receiverUid) {
    throw new Error("Select a different league franchise to receive this offer.");
  }

  const offeredIds = uniquePlayerIds(offeredPlayerIds, "Your offer");
  const requestedIds = uniquePlayerIds(requestedPlayerIds, "Your request");
  const allIds = [...offeredIds, ...requestedIds];
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("A player cannot appear on both sides of a trade offer.");
  }

  const leagueRef = doc(db, "leagues", leagueId);
  const senderTeamRef = doc(db, "leagues", leagueId, "teams", senderUid);
  const receiverTeamRef = doc(db, "leagues", leagueId, "teams", receiverUid);
  const ownershipRefs = allIds.map((playerId) => playerOwnershipRef(leagueId, playerId));
  const tradeRef = doc(collection(db, "leagues", leagueId, "trades"));

  await runTransaction(db, async (transaction) => {
    const [leagueSnapshot, senderTeamSnapshot, receiverTeamSnapshot, ...ownershipSnapshots] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(senderTeamRef),
      transaction.get(receiverTeamRef),
      ...ownershipRefs.map((ownershipRef) => transaction.get(ownershipRef)),
    ]);

    if (!leagueSnapshot.exists()) throw new Error("This league is unavailable.");
    const league = leagueSnapshot.data();
    if (!league.memberIds?.includes(senderUid) || !league.memberIds?.includes(receiverUid)) {
      throw new Error("Both franchises must be active league members.");
    }
    if (!senderTeamSnapshot.exists() || !receiverTeamSnapshot.exists()) {
      throw new Error("One of the selected franchises is unavailable.");
    }

    const senderTeam = senderTeamSnapshot.data();
    const receiverTeam = receiverTeamSnapshot.data();
    const senderRoster = Array.isArray(senderTeam.roster) ? senderTeam.roster : [];
    const receiverRoster = Array.isArray(receiverTeam.roster) ? receiverTeam.roster : [];
    const offeredPlayers = playersForIds(senderRoster, offeredIds, "Your offer");
    const requestedPlayers = playersForIds(receiverRoster, requestedIds, "Your request");

    ownershipSnapshots.forEach((ownershipSnapshot, index) => {
      const expectedOwner = index < offeredIds.length ? senderUid : receiverUid;
      if (!ownershipSnapshot.exists() || ownershipSnapshot.data().ownerUid !== expectedOwner) {
        throw new Error("A selected player is no longer owned by the expected franchise.");
      }
    });

    const senderResultingSize = senderRoster.length - offeredPlayers.length + requestedPlayers.length;
    const receiverResultingSize = receiverRoster.length - requestedPlayers.length + offeredPlayers.length;
    if (senderResultingSize > 5 || receiverResultingSize > 5) {
      throw new Error("This offer would exceed a franchise roster limit.");
    }

    transaction.set(tradeRef, {
      leagueId,
      senderUid,
      receiverUid,
      senderTeam: { uid: senderUid, name: senderTeam.name || "Franchise" },
      receiverTeam: { uid: receiverUid, name: receiverTeam.name || "Franchise" },
      offeredPlayerIds: offeredPlayers.map((player) => player.id),
      requestedPlayerIds: requestedPlayers.map((player) => player.id),
      offeredPlayers: offeredPlayers.map(playerSnapshot),
      requestedPlayers: requestedPlayers.map(playerSnapshot),
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return tradeRef.id;
}
