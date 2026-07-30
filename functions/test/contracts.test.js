import assert from "node:assert/strict";
import test from "node:test";
import {
  ageContractForSeason, buildInitialContract, CONTRACT_STATUS, getContractStatus,
  getTeamCapSpace, getTeamPayroll, initializeMissingContracts, isTeamUnderCap,
  SALARY_CAP, validateTeamContracts,
} from "../shared/contracts.js";

const elite = [98, 97, 96, 95, 94].map((overall, index) => ({ id: index + 1, overall, name: `Player ${index + 1}` }));
const team = { id: "owner", ownerUid: "owner", roster: elite };
const league = { season: 1, status: "regular_season" };

test("initial contracts are deterministic and an elite roster fits the cap", () => {
  const first = buildInitialContract({ player: elite[0], ownerUid: "owner", leagueSeason: 1, leagueStatus: "regular_season" });
  const second = buildInitialContract({ player: elite[0], ownerUid: "owner", leagueSeason: 1, leagueStatus: "regular_season" });
  assert.deepEqual(first, second);
  const contracts = initializeMissingContracts({ league, teams: [team] });
  assert.equal(getTeamPayroll(team, contracts), 94_000_000);
  assert.equal(getTeamCapSpace(team, contracts), 6_000_000);
  assert.equal(isTeamUnderCap(team, contracts), true);
  assert.equal(validateTeamContracts(team, contracts).valid, true);
});

test("existing valid contracts are never overwritten and retry is idempotent", () => {
  const existing = initializeMissingContracts({ league, teams: [team] });
  assert.deepEqual(initializeMissingContracts({ league, teams: [team], existingContracts: existing }), []);
  assert.equal(existing[0].salary, 20_000_000);
});

test("malformed money and years are rejected", () => {
  const contracts = initializeMissingContracts({ league, teams: [team] });
  assert.equal(validateTeamContracts(team, contracts.map((contract, index) => index ? contract : { ...contract, salary: 20.5 })).valid, false);
  assert.equal(validateTeamContracts(team, contracts.map((contract, index) => index ? contract : { ...contract, yearsRemaining: -1 })).valid, false);
});

test("contract statuses are derived", () => {
  const contract = buildInitialContract({ player: elite[0], ownerUid: "owner", leagueSeason: 1, leagueStatus: "regular_season" });
  assert.equal(getContractStatus(contract), CONTRACT_STATUS.MULTI_YEAR);
  assert.equal(getContractStatus({ ...contract, yearsRemaining: 1 }), CONTRACT_STATUS.EXPIRING);
  assert.equal(getContractStatus({ ...contract, yearsRemaining: 0 }), CONTRACT_STATUS.EXPIRED);
});

test("aging is season-aware, retry safe, and keeps ownership identity", () => {
  const original = buildInitialContract({ player: elite[0], ownerUid: "owner", leagueSeason: 1, leagueStatus: "regular_season" });
  const afterOne = ageContractForSeason(original, 1);
  const retry = ageContractForSeason(afterOne, 1);
  const afterTwo = ageContractForSeason(retry, 2);
  assert.equal(afterOne.yearsRemaining, 1);
  assert.deepEqual(retry, afterOne);
  assert.equal(afterTwo.yearsRemaining, 0);
  assert.equal(afterTwo.ownerUid, original.ownerUid);
  assert.equal(afterTwo.playerId, original.playerId);
  assert.equal(getContractStatus(afterTwo), CONTRACT_STATUS.EXPIRED);
});

test("initialization does not mutate roster, ownership-shaped identity, or unrelated history", () => {
  const rosterBefore = structuredClone(team.roster);
  const history = Object.freeze({ season: 1, champion: "owner" });
  initializeMissingContracts({ league, teams: [team] });
  assert.deepEqual(team.roster, rosterBefore);
  assert.deepEqual(history, { season: 1, champion: "owner" });
  assert.equal(SALARY_CAP, 100_000_000);
});

test("version two leagues validate all eight contracts against the 140M cap", () => {
  const expandedRoster = [...elite, 91, 89, 85].map((player, index) => typeof player === "number" ? { id: index + 1, overall: player, name: `Player ${index + 1}` } : player);
  const expandedTeam = { id: "owner", ownerUid: "owner", roster: expandedRoster };
  const expandedLeague = { ...league, rosterConfig: { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 } };
  const contracts = initializeMissingContracts({ league: expandedLeague, teams: [expandedTeam] });
  const validation = validateTeamContracts(expandedTeam, contracts, expandedLeague);
  assert.equal(contracts.length, 8);
  assert.equal(validation.salaryCap, 140_000_000);
  assert.equal(validation.valid, true);
  assert.equal(getTeamCapSpace(expandedTeam, contracts, expandedLeague), 140_000_000 - validation.payroll);
});
