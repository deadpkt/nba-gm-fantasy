import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { LINEUP_POSITIONS } from "../utils/team";

export const DEFAULT_LEAGUE_STRATEGY = "balanced";

const displayName = (user) =>
  user.displayName || user.email?.split("@")[0] || "Full Court Player";

const normalizeRecord = (record) => ({
  wins: Number.isFinite(record?.wins) ? record.wins : 0,
  losses: Number.isFinite(record?.losses) ? record.losses : 0,
});

export function normalizeLeagueLineup(roster, lineup = {}) {
  const savedLineup =
    lineup && typeof lineup === "object" && !Array.isArray(lineup)
      ? lineup
      : {};

  return Object.fromEntries(
    LINEUP_POSITIONS.map((position) => [
      position,
      roster.some((player) => player.id === savedLineup[position])
        ? savedLineup[position]
        : null,
    ]),
  );
}

export function createInitialLeagueTeam(user) {
  return {
    ownerUid: user.uid,
    name: `${displayName(user)} Ballers`,
    roster: [],
    lineup: normalizeLeagueLineup([]),
    strategy: DEFAULT_LEAGUE_STRATEGY,
    record: { wins: 0, losses: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function normalizeLeagueTeam(id, data = {}) {
  const roster = Array.isArray(data.roster) ? data.roster : [];

  return {
    id,
    ...data,
    roster,
    lineup: normalizeLeagueLineup(roster, data.lineup),
    // coachStrategy is read only as a migration bridge for league documents
    // created before the canonical strategy field existed.
    strategy: data.strategy || data.coachStrategy || DEFAULT_LEAGUE_STRATEGY,
    record: normalizeRecord(data.record),
  };
}

const leagueTeamRef = (leagueId, userId) =>
  doc(db, "leagues", leagueId, "teams", userId);

async function updateRosterAndLineup(leagueId, userId, change) {
  const teamRef = leagueTeamRef(leagueId, userId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    if (!snapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }

    const current = normalizeLeagueTeam(snapshot.id, snapshot.data());
    const nextRoster = change(current.roster);
    const nextLineup = normalizeLeagueLineup(nextRoster, current.lineup);

    transaction.update(teamRef, {
      roster: nextRoster,
      lineup: nextLineup,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function addLeagueTeamPlayer(leagueId, userId, player) {
  await updateRosterAndLineup(leagueId, userId, (roster) => {
    if (roster.length >= 5 || roster.some((member) => member.id === player.id)) {
      throw new Error("This player cannot be added to the current roster.");
    }
    return [...roster, player];
  });
}

export async function removeLeagueTeamPlayer(leagueId, userId, playerId) {
  await updateRosterAndLineup(leagueId, userId, (roster) =>
    roster.filter((player) => player.id !== playerId),
  );
}

export async function assignLeagueTeamPlayer(
  leagueId,
  userId,
  position,
  playerId,
) {
  if (!LINEUP_POSITIONS.includes(position)) {
    throw new Error("That lineup position is not valid.");
  }

  const teamRef = leagueTeamRef(leagueId, userId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    if (!snapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }

    const current = normalizeLeagueTeam(snapshot.id, snapshot.data());
    if (playerId && !current.roster.some((player) => player.id === playerId)) {
      throw new Error("That player is not on this franchise roster.");
    }

    const nextLineup = Object.fromEntries(
      Object.entries(current.lineup).map(([slot, assignedId]) => [
        slot,
        assignedId === playerId ? null : assignedId,
      ]),
    );
    nextLineup[position] = playerId || null;

    transaction.update(teamRef, {
      lineup: normalizeLeagueLineup(current.roster, nextLineup),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setLeagueTeamStrategy(leagueId, userId, strategy) {
  if (typeof strategy !== "string" || !strategy.trim()) {
    throw new Error("A team strategy is required.");
  }

  await runTransaction(db, async (transaction) => {
    const teamRef = leagueTeamRef(leagueId, userId);
    const snapshot = await transaction.get(teamRef);
    if (!snapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }

    transaction.update(teamRef, {
      strategy: strategy.trim(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function recordLeagueTeamResult(leagueId, userId, won) {
  const teamRef = leagueTeamRef(leagueId, userId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(teamRef);
    if (!snapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }

    const current = normalizeLeagueTeam(snapshot.id, snapshot.data());
    const record = won
      ? { ...current.record, wins: current.record.wins + 1 }
      : { ...current.record, losses: current.record.losses + 1 };

    transaction.update(teamRef, {
      record,
      updatedAt: serverTimestamp(),
    });
  });
}
