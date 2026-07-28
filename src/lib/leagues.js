import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { createInitialLeagueTeam } from "./leagueTeams";

const createLeagueCode = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

const displayName = (user) =>
  user.displayName || user.email?.split("@")[0] || "Full Court Player";

export async function createLeague({ user, name, maxMembers }) {
  const leagueId = createLeagueCode();
  const leagueRef = doc(db, "leagues", leagueId);
  const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
  const teamRef = doc(db, "leagues", leagueId, "teams", user.uid);
  const userRef = doc(db, "users", user.uid);
  const batch = writeBatch(db);

  batch.set(leagueRef, {
    name: name.trim(),
    commissionerUid: user.uid,
    memberIds: [user.uid],
    maxMembers,
    status: "lobby",
    season: 1,
    inviteCode: leagueId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(memberRef, {
    uid: user.uid,
    displayName: displayName(user),
    joinedAt: serverTimestamp(),
    role: "commissioner",
  });
  batch.set(teamRef, createInitialLeagueTeam(user));
  batch.set(
    userRef,
    { activeLeagueId: leagueId, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
  return leagueId;
}

export async function joinLeague({ user, inviteCode }) {
  const leagueId = inviteCode.trim().toUpperCase();
  const leagueRef = doc(db, "leagues", leagueId);
  const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
  const teamRef = doc(db, "leagues", leagueId, "teams", user.uid);
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists()) {
      throw new Error("No league was found with that invite code.");
    }

    const league = leagueSnapshot.data();
    if (league.status !== "lobby") {
      throw new Error("This league is no longer accepting new members.");
    }
    if (
      !league.memberIds.includes(user.uid) &&
      league.memberIds.length >= league.maxMembers
    ) {
      throw new Error("This league is full.");
    }

    if (!league.memberIds.includes(user.uid)) {
      transaction.update(leagueRef, {
        memberIds: [...league.memberIds, user.uid],
        updatedAt: serverTimestamp(),
      });
      transaction.set(memberRef, {
        uid: user.uid,
        displayName: displayName(user),
        joinedAt: serverTimestamp(),
        role: "member",
      });
      transaction.set(teamRef, createInitialLeagueTeam(user));
    }

    transaction.set(
      userRef,
      { activeLeagueId: leagueId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
  return leagueId;
}

export async function selectLeague(userId, leagueId) {
  const member = await getDoc(doc(db, "leagues", leagueId, "members", userId));
  if (!member.exists()) {
    throw new Error("You are not a member of this league.");
  }

  await runTransaction(db, async (transaction) => {
    transaction.set(
      doc(db, "users", userId),
      { activeLeagueId: leagueId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
}
