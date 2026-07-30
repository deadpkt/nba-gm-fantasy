import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import {
  claimLeaguePlayerOwnership,
  releaseLeaguePlayerOwnership,
} from "./playerOwnership";
import { buildLineupAssignment, getLineupValidation, LINEUP_POSITIONS, normalizePlayerId, normalizeRosterLineup } from "../utils/team";
import { LEAGUE_STATUS } from "./leagueStatuses";
import { buildOffseasonReadyMemberIds, normalizeOffseasonPreparation } from "./offseasonPreparation";
import { normalizeRosterConfig } from "./rosterConfig";
import { canBuildLegalStartingFive } from "./lineupFeasibility";

export const DEFAULT_LEAGUE_STRATEGY = "balanced";

const displayName = (user) =>
  user.displayName || user.email?.split("@")[0] || "Full Court Player";

const normalizeRecord = (record) => ({
  wins: Number.isFinite(record?.wins) ? record.wins : 0,
  losses: Number.isFinite(record?.losses) ? record.losses : 0,
});

export function normalizeLeagueLineup(roster, lineup = {}) {
  return normalizeRosterLineup(roster, lineup);
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

export function isLeagueTeamSeasonReady(teamData = {}, league = {}) {
  const roster = Array.isArray(teamData.roster) ? teamData.roster : [];
  const lineup = teamData.lineup || {};
  return roster.length === normalizeRosterConfig(league).rosterSize && canBuildLegalStartingFive(roster).valid && getLineupValidation(roster, lineup).valid;
}

export function buildLeagueLineupAssignment(roster, lineup, position, playerId) {
  return buildLineupAssignment(roster, lineup, position, playerId);
}

const leagueTeamRef = (leagueId, userId) =>
  doc(db, "leagues", leagueId, "teams", userId);

export async function setLeagueTeamSeasonConfirmation(
  leagueId,
  userId,
  confirmed,
) {
  const teamRef = leagueTeamRef(leagueId, userId);
  const leagueRef = doc(db, "leagues", leagueId);

  await runTransaction(db, async (transaction) => {
    const [teamSnapshot, leagueSnapshot] = await Promise.all([
      transaction.get(teamRef),
      transaction.get(leagueRef),
    ]);
    if (!teamSnapshot.exists() || !leagueSnapshot.exists()) {
      throw new Error("Your franchise or league is unavailable.");
    }

    const league = leagueSnapshot.data();
    if (league.status !== LEAGUE_STATUS.SEASON_READY) {
      throw new Error("Lineups can only be confirmed during team setup.");
    }
    if (confirmed && !isLeagueTeamSeasonReady(teamSnapshot.data(), league)) {
      throw new Error("Assign a unique roster player at PG, SG, SF, PF, and C first.");
    }

    const readyIds = Array.isArray(league.seasonReadyMemberIds)
      ? league.seasonReadyMemberIds
      : [];
    const alreadyConfirmed = readyIds.includes(userId);
    if (alreadyConfirmed === Boolean(confirmed)) return;

    transaction.update(leagueRef, {
      seasonReadyMemberIds: confirmed
        ? [...new Set([...readyIds, userId])]
        : readyIds.filter((memberId) => memberId !== userId),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function setLeagueTeamOffseasonConfirmation(leagueId, userId, confirmed) {
  const teamRef = leagueTeamRef(leagueId, userId);
  const leagueRef = doc(db, "leagues", leagueId);
  await runTransaction(db, async (transaction) => {
    const [teamSnapshot, leagueSnapshot] = await Promise.all([transaction.get(teamRef), transaction.get(leagueRef)]);
    if (!teamSnapshot.exists() || !leagueSnapshot.exists()) throw new Error("Your franchise or league is unavailable.");
    const league = leagueSnapshot.data();
    const preparation = normalizeOffseasonPreparation(league);
    const readyMemberIds = buildOffseasonReadyMemberIds({ league, actorUid: userId, targetUid: userId, confirmed, team: teamSnapshot.data() });
    transaction.update(leagueRef, {
      offseason: { ...league.offseason, preparationVersion: 1, nextSeason: preparation.nextSeason, readyMemberIds },
      updatedAt: serverTimestamp(),
    });
  });
}

async function updateRosterAndLineup(
  leagueId,
  userId,
  change,
  updateOwnership = null,
) {
  const teamRef = leagueTeamRef(leagueId, userId);
  const leagueRef = doc(db, "leagues", leagueId);

  await runTransaction(db, async (transaction) => {
    const [snapshot, leagueSnapshot] = await Promise.all([transaction.get(teamRef), transaction.get(leagueRef)]);
    if (!snapshot.exists() || !leagueSnapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }

    const current = normalizeLeagueTeam(snapshot.id, snapshot.data());
    const nextRoster = change(current.roster, leagueSnapshot.data());
    const nextLineup = normalizeLeagueLineup(nextRoster, current.lineup);

    if (updateOwnership) {
      await updateOwnership(transaction, current.roster, nextRoster);
    }

    transaction.update(teamRef, {
      roster: nextRoster,
      lineup: nextLineup,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function addLeagueTeamPlayer(leagueId, userId, player) {
  if (player?.id === undefined || player?.id === null) {
    throw new Error("This player cannot be added to the current roster.");
  }

  await updateRosterAndLineup(leagueId, userId, (roster, league) => {
    if (
      roster.length >= normalizeRosterConfig(league).rosterSize ||
      roster.some((member) => normalizePlayerId(member.id) === normalizePlayerId(player.id))
    ) {
      throw new Error("This player cannot be added to the current roster.");
    }
    return [...roster, player];
  }, async (transaction) => {
    await claimLeaguePlayerOwnership(transaction, leagueId, player.id, userId);
  });
}

export async function removeLeagueTeamPlayer(leagueId, userId, playerId) {
  await updateRosterAndLineup(
    leagueId,
    userId,
    (roster) => roster.filter((player) => normalizePlayerId(player.id) !== normalizePlayerId(playerId)),
    async (transaction, roster) => {
      if (roster.some((player) => normalizePlayerId(player.id) === normalizePlayerId(playerId))) {
        await releaseLeaguePlayerOwnership(
          transaction,
          leagueId,
          playerId,
          userId,
        );
      }
    },
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
  const leagueRef = doc(db, "leagues", leagueId);
  await runTransaction(db, async (transaction) => {
    const [snapshot, leagueSnapshot] = await Promise.all([
      transaction.get(teamRef),
      transaction.get(leagueRef),
    ]);
    if (!snapshot.exists()) {
      throw new Error("Your franchise could not be found in this league.");
    }
    if (!leagueSnapshot.exists()) {
      throw new Error("This league is unavailable.");
    }

    const current = normalizeLeagueTeam(snapshot.id, snapshot.data());
    const normalizedLineup = buildLeagueLineupAssignment(current.roster, current.lineup, position, playerId);
    transaction.update(teamRef, {
      lineup: normalizedLineup,
      updatedAt: serverTimestamp(),
    });

    const league = leagueSnapshot.data();
    if (league.status === LEAGUE_STATUS.SEASON_READY) {
      const readyIds = Array.isArray(league.seasonReadyMemberIds)
        ? league.seasonReadyMemberIds
        : [];
      if (readyIds.includes(userId)) {
        transaction.update(leagueRef, {
          seasonReadyMemberIds: readyIds.filter((memberId) => memberId !== userId),
          updatedAt: serverTimestamp(),
        });
      }
    } else if (league.status === LEAGUE_STATUS.OFFSEASON) {
      const preparation = normalizeOffseasonPreparation(league);
      if (preparation.readyMemberIds.includes(userId)) {
        transaction.update(leagueRef, {
          offseason: { ...league.offseason, preparationVersion: 1, nextSeason: preparation.nextSeason, readyMemberIds: preparation.readyMemberIds.filter((memberId) => memberId !== userId) },
          updatedAt: serverTimestamp(),
        });
      }
    }
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
