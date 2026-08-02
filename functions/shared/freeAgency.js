import {
  buildInitialContract,
  isValidContract,
} from "./contracts.js";
import { getLeagueSalaryCap, normalizeRosterConfig } from "./rosterConfig.js";

const playerKey = (value) => String(value);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function ownerId(team) {
  return team?.ownerUid || team?.id;
}

function readyWithout(league, uid) {
  return (league?.offseason?.readyMemberIds || []).filter((memberId) => memberId !== uid);
}

function validateOffseasonActor({ league, team, actorUid }) {
  if (league?.status !== "offseason") fail("offseason-required", "Free Agency is available only during offseason.");
  if (!league.memberIds?.includes(actorUid)) fail("member-required", "League membership is required.");
  if (!team || ownerId(team) !== actorUid) fail("team-required", "Your franchise team is unavailable.");
}

function validOwnedContracts(team, contracts) {
  const uid = ownerId(team);
  const byPlayer = new Map(contracts.filter((contract) => contract?.ownerUid === uid).map((contract) => [playerKey(contract.playerId), contract]));
  for (const player of team.roster || []) {
    const contract = byPlayer.get(playerKey(player.id));
    if (!isValidContract(contract)) fail("contracts-invalid", "Every currently rostered player needs a valid contract before signing.");
  }
  return byPlayer;
}

export function getProjectedFreeAgentContract({ player, league }) {
  return buildInitialContract({
    player,
    ownerUid: "projected-owner",
    leagueSeason: league.season,
    leagueStatus: league.status,
  });
}

export function buildFreeAgentSigning({ league, team, contracts = [], player, rosterPlayer = player, actorUid, ownershipExists = false, contractExists = false }) {
  validateOffseasonActor({ league, team, actorUid });
  if (!player || player.active !== true || player.draftEligible !== true) fail("player-ineligible", "This player is not eligible for Free Agency.");
  if (ownershipExists) fail("player-owned", "Player is no longer available.");
  if (contractExists) fail("contract-conflict", "This player already has a league contract.");
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const rosterSize = normalizeRosterConfig(league).rosterSize;
  if (roster.some((item) => playerKey(item.id) === playerKey(player.id))) fail("player-owned", "This player is already on your roster.");
  if (roster.length >= rosterSize) fail("roster-full", `Your roster is full at ${rosterSize} players.`);
  const existing = validOwnedContracts(team, contracts);
  const contract = buildInitialContract({ player, ownerUid: actorUid, leagueSeason: league.season, leagueStatus: league.status });
  const payroll = [...existing.values()].reduce((sum, item) => sum + item.salary, 0);
  const salaryCap = getLeagueSalaryCap(league);
  if (payroll + contract.salary > salaryCap) {
    const overBy = payroll + contract.salary - salaryCap;
    fail("over-cap", `Signing would put your franchise $${overBy / 1_000_000}M over the salary cap.`);
  }
  return {
    roster: [...roster, rosterPlayer],
    lineup: { ...(team.lineup || {}) },
    contract,
    payrollAfter: payroll + contract.salary,
    salaryCap,
    readyMemberIds: readyWithout(league, actorUid),
  };
}

export function buildPlayerRelease({ league, team, contract, playerId, actorUid, ownershipOwnerUid }) {
  validateOffseasonActor({ league, team, actorUid });
  const key = playerKey(playerId);
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const player = roster.find((item) => playerKey(item.id) === key);
  if (!player) fail("player-not-rostered", "That player is not on your franchise roster.");
  if (ownershipOwnerUid !== actorUid) fail("ownership-conflict", "Only the owning franchise can release this player.");
  if (!isValidContract(contract) || contract.ownerUid !== actorUid || playerKey(contract.playerId) !== key) fail("contract-conflict", "The player contract does not match your franchise.");
  const lineup = Object.fromEntries(Object.entries(team.lineup || {}).map(([position, assignedId]) => [
    position,
    playerKey(assignedId) === key ? null : assignedId,
  ]));
  return {
    player,
    roster: roster.filter((item) => playerKey(item.id) !== key),
    lineup,
    readyMemberIds: readyWithout(league, actorUid),
  };
}

export function buildExpiredContractCleanup({ league, teams = [], contracts = [] }) {
  const teamsByOwner = new Map(teams.map((team) => [ownerId(team), team]));
  const releases = [];
  for (const contract of contracts) {
    if (!isValidContract(contract) || contract.yearsRemaining !== 0) continue;
    const team = teamsByOwner.get(contract.ownerUid);
    const player = team?.roster?.find((item) => playerKey(item.id) === playerKey(contract.playerId));
    if (team && player) releases.push(buildPlayerRelease({ league: { ...league, status: "offseason" }, team, contract, playerId: contract.playerId, actorUid: contract.ownerUid, ownershipOwnerUid: contract.ownerUid }));
  }
  return releases;
}
