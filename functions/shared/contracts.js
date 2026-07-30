import { getLeagueSalaryCap, LEGACY_SALARY_CAP, normalizeRosterConfig } from "./rosterConfig.js";

export const CONTRACT_VERSION = 1;
export const SALARY_CAP = LEGACY_SALARY_CAP;
export const MIN_SALARY = 11_000_000;
export const MAX_SALARY = 20_000_000;
export const MIN_CONTRACT_YEARS = 0;
export const MAX_CONTRACT_YEARS = 5;
export const INITIAL_CONTRACT_YEARS = 2;

export const CONTRACT_STATUS = Object.freeze({ MULTI_YEAR: "MULTI_YEAR", EXPIRING: "EXPIRING", EXPIRED: "EXPIRED" });

export function getInitialSalary(overall) {
  if (!Number.isInteger(overall) || overall < 0 || overall > 100) throw new Error("A valid integer player overall is required.");
  if (overall >= 96) return 20_000_000;
  if (overall >= 93) return 17_000_000;
  if (overall >= 90) return 14_000_000;
  return MIN_SALARY;
}

export function buildInitialContract({ player, ownerUid, leagueSeason, leagueStatus }) {
  if (player?.id === undefined || player?.id === null || !ownerUid) throw new Error("Player and owner identity are required.");
  if (!Number.isInteger(leagueSeason) || leagueSeason < 1) throw new Error("A valid league season is required.");
  const offseason = leagueStatus === "offseason";
  return {
    playerId: player.id,
    ownerUid,
    salary: getInitialSalary(player.overall),
    yearsRemaining: INITIAL_CONTRACT_YEARS,
    signedSeason: offseason ? leagueSeason + 1 : leagueSeason,
    lastAgedSeason: offseason ? leagueSeason : leagueSeason - 1,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isValidContract(contract) {
  return Boolean(contract)
    && contract.contractVersion === CONTRACT_VERSION
    && contract.playerId !== undefined && contract.playerId !== null
    && typeof contract.ownerUid === "string" && contract.ownerUid.length > 0
    && Number.isInteger(contract.salary) && contract.salary >= MIN_SALARY && contract.salary <= MAX_SALARY
    && Number.isInteger(contract.yearsRemaining) && contract.yearsRemaining >= MIN_CONTRACT_YEARS && contract.yearsRemaining <= MAX_CONTRACT_YEARS
    && Number.isInteger(contract.signedSeason) && contract.signedSeason >= 1
    && Number.isInteger(contract.lastAgedSeason) && contract.lastAgedSeason >= 0;
}

export function validateTeamContracts(team, contracts = [], league = {}) {
  const roster = Array.isArray(team?.roster) ? team.roster : [];
  const rosterSize = normalizeRosterConfig(league).rosterSize;
  const salaryCap = getLeagueSalaryCap(league);
  const byPlayer = new Map(contracts.filter((contract) => contract?.ownerUid === (team?.ownerUid || team?.id)).map((contract) => [String(contract.playerId), contract]));
  const rosterContracts = roster.map((player) => byPlayer.get(String(player.id)));
  const errors = [];
  if (roster.length !== rosterSize) errors.push("ROSTER_SIZE");
  if (rosterContracts.some((contract) => !contract)) errors.push("MISSING_CONTRACT");
  if (rosterContracts.some((contract) => contract && !isValidContract(contract))) errors.push("MALFORMED_CONTRACT");
  const payroll = rosterContracts.reduce((sum, contract) => sum + (isValidContract(contract) ? contract.salary : 0), 0);
  if (payroll > salaryCap) errors.push("OVER_CAP");
  return { valid: errors.length === 0, errors, payroll, salaryCap, contracts: rosterContracts.filter(Boolean) };
}

export function getTeamPayroll(team, contracts = [], league = {}) { return validateTeamContracts(team, contracts, league).payroll; }
export function getTeamCapSpace(team, contracts = [], league = {}) { return getLeagueSalaryCap(league) - getTeamPayroll(team, contracts, league); }
export function isTeamUnderCap(team, contracts = [], league = {}) { return getTeamPayroll(team, contracts, league) <= getLeagueSalaryCap(league); }

export function getContractStatus(contract) {
  if (!isValidContract(contract)) return null;
  if (contract.yearsRemaining === 0) return CONTRACT_STATUS.EXPIRED;
  if (contract.yearsRemaining === 1) return CONTRACT_STATUS.EXPIRING;
  return CONTRACT_STATUS.MULTI_YEAR;
}

export function ageContractForSeason(contract, completedSeason) {
  if (!isValidContract(contract)) throw new Error("A valid contract is required for aging.");
  if (!Number.isInteger(completedSeason) || completedSeason < 1) throw new Error("A valid completed season is required.");
  if (contract.lastAgedSeason >= completedSeason || contract.signedSeason > completedSeason) return contract;
  return { ...contract, yearsRemaining: Math.max(0, contract.yearsRemaining - 1), lastAgedSeason: completedSeason };
}

export function initializeMissingContracts({ league, teams, existingContracts = [] }) {
  const existing = new Map(existingContracts.map((contract) => [String(contract.playerId), contract]));
  const creates = [];
  teams.forEach((team) => (team.roster || []).forEach((player) => {
    const current = existing.get(String(player.id));
    if (current) {
      if (!isValidContract(current) || current.ownerUid !== (team.ownerUid || team.id)) throw new Error("An existing player contract is malformed or conflicts with ownership.");
      return;
    }
    creates.push(buildInitialContract({ player, ownerUid: team.ownerUid || team.id, leagueSeason: league.season, leagueStatus: league.status }));
  }));
  return creates;
}

export function formatMoney(value) {
  if (!Number.isInteger(value)) return "—";
  const millions = value / 1_000_000;
  return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
}
