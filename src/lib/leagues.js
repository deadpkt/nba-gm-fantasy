import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { buildInitialDraftState, draftStateRef } from "./draft";
import { createInitialLeagueTeam, isLeagueTeamSeasonReady } from "./leagueTeams";
import { LEAGUE_STATUS } from "./leagueStatuses";
import { createSeasonConfig } from "./seasonConfig";
import { normalizeSeasonConfig } from "./seasonConfig";
import { createRosterConfig, normalizeRosterConfig } from "./rosterConfig";
import { createSeasonProgress } from "./seasonProgress";
import {
  generateRegularSeasonSchedule,
  isCurrentScheduleMetadata,
} from "./schedule";

const createLeagueCode = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

const displayName = (user) =>
  user.displayName || user.email?.split("@")[0] || "Full Court Player";

export async function createLeague({ user, name, maxMembers, seasonPreset }) {
  const seasonConfig = createSeasonConfig(maxMembers, seasonPreset);
  const rosterConfig = createRosterConfig();
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
    readyMemberIds: [],
    maxMembers,
    status: LEAGUE_STATUS.LOBBY,
    season: 1,
    seasonConfig,
    rosterConfig,
    inviteCode: leagueId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(memberRef, {
    uid: user.uid,
    displayName: displayName(user),
    joinedAt: serverTimestamp(),
    role: "commissioner",
    ready: false,
    updatedAt: serverTimestamp(),
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
    if (league.status !== LEAGUE_STATUS.LOBBY) {
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
        ready: false,
        updatedAt: serverTimestamp(),
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

export async function setLeagueMemberReady({ leagueId, userId, ready }) {
  const leagueRef = doc(db, "leagues", leagueId);
  const memberRef = doc(db, "leagues", leagueId, "members", userId);

  await runTransaction(db, async (transaction) => {
    const [leagueSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(memberRef),
    ]);
    if (!leagueSnapshot.exists() || !memberSnapshot.exists()) {
      throw new Error("This league membership is unavailable.");
    }
    if (leagueSnapshot.data().status !== LEAGUE_STATUS.LOBBY) {
      throw new Error("Readiness can only change while the league is in the lobby.");
    }

    const league = leagueSnapshot.data();
    const readyMemberIds = Array.isArray(league.readyMemberIds)
      ? league.readyMemberIds
      : [];
    const nextReadyMemberIds = ready
      ? [...new Set([...readyMemberIds, userId])]
      : readyMemberIds.filter((memberId) => memberId !== userId);

    transaction.update(memberRef, {
      ready: Boolean(ready),
      updatedAt: serverTimestamp(),
    });
    transaction.update(leagueRef, {
      readyMemberIds: nextReadyMemberIds,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function startLeagueDraft({ leagueId, userId }) {
  const leagueRef = doc(db, "leagues", leagueId);

  await runTransaction(db, async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists()) throw new Error("This league is unavailable.");

    const league = leagueSnapshot.data();
    if (league.commissionerUid !== userId) {
      throw new Error("Only the commissioner can start the draft phase.");
    }
    if (league.status !== LEAGUE_STATUS.LOBBY) {
      throw new Error("The draft phase can only start from the lobby.");
    }
    if (league.memberIds.length !== league.maxMembers) {
      throw new Error("Every league slot must be filled before the draft can start.");
    }
    const readyMemberIds = Array.isArray(league.readyMemberIds)
      ? league.readyMemberIds
      : [];
    if (
      readyMemberIds.length !== league.memberIds.length ||
      !league.memberIds.every((memberId) => readyMemberIds.includes(memberId))
    ) {
      throw new Error("Every league member must be ready before the draft can start.");
    }

    const stateRef = draftStateRef(leagueId);
    const [draftSnapshot, ...memberAndTeamSnapshots] = await Promise.all([
      transaction.get(stateRef),
      ...league.memberIds.map((memberId) =>
        transaction.get(doc(db, "leagues", leagueId, "members", memberId)),
      ),
      ...league.memberIds.map((memberId) =>
        transaction.get(doc(db, "leagues", leagueId, "teams", memberId)),
      ),
    ]);
    if (draftSnapshot.exists()) {
      throw new Error("This league draft has already been initialized.");
    }
    const memberSnapshots = memberAndTeamSnapshots.slice(
      0,
      league.memberIds.length,
    );
    const teamSnapshots = memberAndTeamSnapshots.slice(league.memberIds.length);
    if (memberSnapshots.some((snapshot) => !snapshot.exists() || snapshot.data().ready !== true)) {
      throw new Error("Every league member must be ready before the draft can start.");
    }
    if (
      teamSnapshots.some(
        (snapshot) =>
          !snapshot.exists() || (snapshot.data().roster || []).length !== 0,
      )
    ) {
      throw new Error(
        "Every franchise roster must be empty before the shared draft starts.",
      );
    }

    transaction.update(leagueRef, {
      status: LEAGUE_STATUS.DRAFTING,
      draftStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(
      stateRef,
      buildInitialDraftState(leagueId, [...league.memberIds], normalizeRosterConfig(league).rosterSize),
    );
  });
}

export async function startLeagueSeason({ leagueId, userId }) {
  const leagueRef = doc(db, "leagues", leagueId);

  await runTransaction(db, async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists()) throw new Error("This league is unavailable.");

    const league = leagueSnapshot.data();
    if (league.commissionerUid !== userId) {
      throw new Error("Only the commissioner can start the season.");
    }
    const seasonConfig = normalizeSeasonConfig(
      league.maxMembers,
      league.seasonConfig,
    );
    if (league.status === LEAGUE_STATUS.REGULAR_SEASON) {
      if (isCurrentScheduleMetadata(league, seasonConfig)) return;
      throw new Error("This season is active but its schedule metadata is invalid.");
    }
    if (league.status !== LEAGUE_STATUS.SEASON_READY) {
      throw new Error("The season can only start after the draft is complete.");
    }

    const teamSnapshots = await Promise.all(
      league.memberIds.map((memberId) =>
        transaction.get(doc(db, "leagues", leagueId, "teams", memberId)),
      ),
    );
    if (
      teamSnapshots.some(
        (snapshot) =>
          !snapshot.exists() || !isLeagueTeamSeasonReady(snapshot.data(), league),
      )
    ) {
      throw new Error(
        `Every franchise needs exactly ${normalizeRosterConfig(league).rosterSize} drafted players and a complete valid Starting Five.`,
      );
    }

    const readyIds = Array.isArray(league.seasonReadyMemberIds)
      ? league.seasonReadyMemberIds
      : [];
    if (
      readyIds.length !== league.memberIds.length ||
      !league.memberIds.every((memberId) => readyIds.includes(memberId))
    ) {
      throw new Error("Every franchise must be ready before the season can start.");
    }

    const teamNames = Object.fromEntries(
      teamSnapshots.map((snapshot) => [
        snapshot.id,
        snapshot.data().name || snapshot.id,
      ]),
    );
    const generatedSchedule = generateRegularSeasonSchedule({
      leagueId,
      season: league.season,
      memberIds: [...league.memberIds],
      seasonConfig,
      teamNames,
    });
    const gameRefs = generatedSchedule.games.map((game) =>
      doc(db, "leagues", leagueId, "games", game.id),
    );
    const gameSnapshots = await Promise.all(
      gameRefs.map((gameRef) => transaction.get(gameRef)),
    );
    if (gameSnapshots.some((snapshot) => snapshot.exists())) {
      throw new Error("Official schedule documents already exist for this season.");
    }

    generatedSchedule.games.forEach(({ id: _id, ...game }, index) => {
      transaction.set(gameRefs[index], {
        ...game,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    transaction.update(leagueRef, {
      status: LEAGUE_STATUS.REGULAR_SEASON,
      seasonConfig,
      schedule: {
        ...generatedSchedule.metadata,
        generatedAt: serverTimestamp(),
      },
      seasonProgress: createSeasonProgress(generatedSchedule.metadata.totalRounds),
      seasonStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function leaveLeague({ leagueId, userId }) {
  const leagueRef = doc(db, "leagues", leagueId);
  const memberRef = doc(db, "leagues", leagueId, "members", userId);
  const teamRef = doc(db, "leagues", leagueId, "teams", userId);
  const userRef = doc(db, "users", userId);

  await runTransaction(db, async (transaction) => {
    const [leagueSnapshot, memberSnapshot, teamSnapshot, userSnapshot] =
      await Promise.all([
        transaction.get(leagueRef),
        transaction.get(memberRef),
        transaction.get(teamRef),
        transaction.get(userRef),
      ]);
    if (!leagueSnapshot.exists() || !memberSnapshot.exists()) {
      throw new Error("This league membership is unavailable.");
    }

    const league = leagueSnapshot.data();
    if (league.status !== LEAGUE_STATUS.LOBBY) {
      throw new Error("You can only leave while the league is in the lobby.");
    }
    if (league.commissionerUid === userId) {
      throw new Error("The commissioner must cancel the league instead.");
    }
    if ((teamSnapshot.data()?.roster || []).length) {
      throw new Error("Clear this franchise roster before leaving the league.");
    }

    transaction.update(leagueRef, {
      memberIds: league.memberIds.filter((memberId) => memberId !== userId),
      readyMemberIds: (league.readyMemberIds || []).filter(
        (memberId) => memberId !== userId,
      ),
      updatedAt: serverTimestamp(),
    });
    transaction.delete(memberRef);
    if (teamSnapshot.exists()) transaction.delete(teamRef);
    if (userSnapshot.data()?.activeLeagueId === leagueId) {
      transaction.update(userRef, {
        activeLeagueId: null,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function cancelLeague({ leagueId, userId }) {
  const leagueRef = doc(db, "leagues", leagueId);
  await runTransaction(db, async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists()) throw new Error("This league is unavailable.");

    const league = leagueSnapshot.data();
    if (league.commissionerUid !== userId) {
      throw new Error("Only the commissioner can cancel this league.");
    }
    if (league.status !== LEAGUE_STATUS.LOBBY) {
      throw new Error("A league can only be cancelled while it is in the lobby.");
    }

    transaction.update(leagueRef, {
      status: LEAGUE_STATUS.CANCELLED,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    league.memberIds.forEach((memberId) => {
      transaction.update(doc(db, "users", memberId), {
        activeLeagueId: null,
        updatedAt: serverTimestamp(),
      });
    });
  });
}
