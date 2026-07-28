import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { saveMatchHistory } from "./matchHistory";
import { getLineupPlayers, getMissingLineupPositions } from "../utils/team";
import { createLiveGame, simulatePossession } from "../utils/liveSimulation";

const inviteCode = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

function teamSnapshot(user, team, lineup) {
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Full Court Player",
    players: getLineupPlayers(team, lineup),
    lineup,
  };
}

function requireCompleteLineup(team, lineup, action) {
  const missingPositions = getMissingLineupPositions(team, lineup);
  if (missingPositions.length) {
    throw new Error(
      `${action} requires a complete starting lineup. Missing: ${missingPositions.join(
        ", ",
      )}.`,
    );
  }
}

function getMatchResult(match, simulation) {
  const homeWon = simulation.homeScore > simulation.awayScore;
  const winner = homeWon ? match.host : match.guest;
  const loser = homeWon ? match.guest : match.host;

  return {
    winner: { uid: winner.uid, name: winner.name },
    loser: { uid: loser.uid, name: loser.name },
    finalScore: {
      home: simulation.homeScore,
      away: simulation.awayScore,
    },
    mvp: simulation.mvp,
    playerStatistics: {
      home: simulation.homeStats,
      away: simulation.awayStats,
    },
    teamStatistics: {
      home: simulation.homeTeamStats,
      away: simulation.awayTeamStats,
    },
    lineups: {
      home: match.host,
      away: match.guest,
    },
  };
}

export async function saveUserMatchHistory(match, userId) {
  if (!match.result || !match.completedAt) return;

  if (match.guestUid !== userId && match.hostUid !== userId) return;

  const side = match.hostUid === userId ? "home" : "away";
  const opponentSide = side === "home" ? "away" : "home";
  const userWon = match.result.winner.uid === userId;

  await saveMatchHistory({
    userId,
    leagueId: match.leagueId,
    matchId: match.id,
    matchDate: match.completedAt,
    result: match.result,
    team: match.result.lineups[side],
    opponent: match.result.lineups[opponentSide],
    won: userWon,
  });
}

export async function createMatchRoom({ user, leagueId, roster, lineup }) {
  if (!leagueId) throw new Error("Select a league before creating a match.");
  requireCompleteLineup(roster, lineup, "Creating an online match");
  return addDoc(collection(db, "matches"), {
    leagueId,
    inviteCode: inviteCode(),
    hostUid: user.uid,
    guestUid: null,
    host: teamSnapshot(user, roster, lineup),
    guest: null,
    ready: { host: false, guest: false },
    status: "waiting",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function joinMatchRoom(
  matchId,
  { user, leagueId, roster, lineup },
) {
  if (!leagueId) throw new Error("Select a league before joining a match.");
  requireCompleteLineup(roster, lineup, "Joining an online match");
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(matchRef);
    if (!snapshot.exists())
      throw new Error("This match room no longer exists.");
    const match = snapshot.data();
    if (match.leagueId !== leagueId) {
      throw new Error("This match belongs to a different league.");
    }
    if (match.hostUid === user.uid || match.guestUid === user.uid) return;
    if (match.guestUid)
      throw new Error("This match room already has two players.");
    if (match.status !== "waiting")
      throw new Error("This match has already started.");
    transaction.update(matchRef, {
      guestUid: user.uid,
      guest: teamSnapshot(user, roster, lineup),
      ready: { host: false, guest: false },
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setMatchReady(matchId, userId, ready) {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(matchRef);
    if (!snapshot.exists())
      throw new Error("This match room no longer exists.");
    const match = snapshot.data();
    const side =
      match.hostUid === userId
        ? "host"
        : match.guestUid === userId
          ? "guest"
          : null;
    if (!side) throw new Error("You are not a player in this match.");
    if (!match.guestUid) throw new Error("Waiting for an opponent to join.");
    requireCompleteLineup(
      match[side].players || [],
      match[side].lineup,
      "Marking a team ready",
    );
    transaction.update(matchRef, {
      [`ready.${side}`]: ready,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function startMatchRoom(matchId, userId) {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(matchRef);
    if (!snapshot.exists())
      throw new Error("This match room no longer exists.");
    const match = snapshot.data();
    if (match.hostUid !== userId && match.guestUid !== userId)
      throw new Error("You are not a player in this match.");
    if (!match.ready?.host || !match.ready?.guest)
      throw new Error("Both players must be ready before the match can start.");
    requireCompleteLineup(
      match.host?.players || [],
      match.host?.lineup,
      "Starting the match for the home team",
    );
    requireCompleteLineup(
      match.guest?.players || [],
      match.guest?.lineup,
      "Starting the match for the away team",
    );
    transaction.update(matchRef, {
      status: "in_progress",
      simulation: createLiveGame(match.host.players, match.guest.players),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function advanceMatchSimulation(matchId, userId) {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(matchRef);
    if (!snapshot.exists())
      throw new Error("This match room no longer exists.");
    const match = snapshot.data();
    if (match.hostUid !== userId) return;
    if (match.status !== "in_progress" || match.simulation?.completed) return;
    const simulation = simulatePossession(
      match.simulation,
      match.host.players,
      match.guest.players,
    );
    const update = {
      simulation,
      updatedAt: serverTimestamp(),
    };

    if (simulation.completed) {
      update.status = "completed";
      update.result = getMatchResult(match, simulation);
      update.completedAt = serverTimestamp();
    }

    transaction.update(matchRef, update);
  });
}
