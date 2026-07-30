import { LEAGUE_STATUS } from "./leagueStatuses.js";
import { getLineupValidation } from "../utils/team.js";
import { validateTeamContracts } from "../../functions/shared/contracts.js";
import { normalizeRosterConfig } from "./rosterConfig.js";
import { canBuildLegalStartingFive } from "./lineupFeasibility.js";

function hasValidFivePlayerLineup(team = {}) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  return getLineupValidation(roster, team.lineup).valid;
}

export function normalizeOffseasonPreparation(league = {}) {
  const expectedNextSeason = Number.isInteger(league.season) ? league.season + 1 : 1;
  const offseason = league.offseason || {};
  const nextSeason = Number.isInteger(offseason.nextSeason) ? offseason.nextSeason : expectedNextSeason;
  return {
    preparationVersion: offseason.preparationVersion || 1,
    nextSeason,
    readyMemberIds: nextSeason === expectedNextSeason && Array.isArray(offseason.readyMemberIds) ? [...new Set(offseason.readyMemberIds)] : [],
  };
}

export function getOffseasonTeamPreparationState({ league, team, userId, contracts = [] }) {
  const preparation = normalizeOffseasonPreparation(league);
  const rosterFeasible = canBuildLegalStartingFive(team?.roster).valid;
  const rosterValid = Array.isArray(team?.roster) && team.roster.length === normalizeRosterConfig(league).rosterSize && rosterFeasible;
  const lineupValid = hasValidFivePlayerLineup(team);
  const ownerConfirmed = preparation.readyMemberIds.includes(userId);
  const contractsInitialized = league?.contractVersion === 1;
  const contractValidation = contractsInitialized ? validateTeamContracts(team, contracts, league) : null;
  const capValid = contractsInitialized ? contractValidation.valid : true;
  return { nextSeason: preparation.nextSeason, requirements: { rosterValid, rosterFeasible, lineupValid, contractsInitialized, capValid, ownerConfirmed }, payroll: contractValidation?.payroll || 0, ready: rosterValid && lineupValid && capValid && ownerConfirmed };
}

export function buildOffseasonReadyMemberIds({ league, actorUid, targetUid, confirmed, team }) {
  if (actorUid !== targetUid) throw new Error("A franchise owner can only confirm their own team.");
  if (league?.status !== LEAGUE_STATUS.OFFSEASON || !league.memberIds?.includes(actorUid)) throw new Error("Offseason membership is required.");
  if (confirmed && !hasValidFivePlayerLineup(team)) throw new Error("Assign a unique roster player at PG, SG, SF, PF, and C first.");
  const current = normalizeOffseasonPreparation(league).readyMemberIds;
  return confirmed ? [...new Set([...current, actorUid])] : current.filter((uid) => uid !== actorUid);
}
