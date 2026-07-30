import { buildInitialContract, isValidContract } from "./contracts.js";
import { canBuildLegalStartingFive } from "./lineupFeasibility.js";
import { getLeagueSalaryCap, normalizeRosterConfig } from "./rosterConfig.js";

const key = (value) => String(value);

export function buildPreseasonRosterRepair({ league, team, actorUid, dropPlayerId, incomingPlayer, dropOwnershipOwnerUid, addOwnershipExists = false, contracts = [], dropContract = null, addContractExists = false }) {
  if (!league?.memberIds?.includes(actorUid) || team?.ownerUid !== actorUid) throw new Error("Only the franchise owner can repair this roster.");
  if (league.status !== "season_ready" || league.season !== 1 || league.seasonStartedAt) throw new Error("Roster repair is limited to the initial post-Draft team setup.");
  const rosterSize = normalizeRosterConfig(league).rosterSize;
  if (!Array.isArray(team.roster) || team.roster.length !== rosterSize || canBuildLegalStartingFive(team.roster).valid) throw new Error("Only a full, infeasible post-Draft roster can be repaired.");
  const outgoing = team.roster.find((player) => key(player.id) === key(dropPlayerId));
  if (!outgoing || dropOwnershipOwnerUid !== actorUid) throw new Error("The outgoing player is not owned by this franchise.");
  if (addOwnershipExists) throw new Error("The incoming player is no longer available.");
  if (!incomingPlayer || incomingPlayer.active !== true || incomingPlayer.draftEligible !== true) throw new Error("The incoming player is not Draft eligible.");
  const nextRoster = team.roster.map((player) => key(player.id) === key(dropPlayerId) ? incomingPlayer : player);
  const feasibility = canBuildLegalStartingFive(nextRoster);
  if (nextRoster.length !== rosterSize || !feasibility.valid) throw new Error("That replacement still cannot build a legal Starting Five.");
  const lineup = Object.fromEntries(["PG", "SG", "SF", "PF", "C"].map((position) => [position, key(team.lineup?.[position]) === key(dropPlayerId) ? null : team.lineup?.[position] ?? null]));
  let newContract = null;
  if (league.contractVersion === 1) {
    if (!isValidContract(dropContract) || dropContract.ownerUid !== actorUid || addContractExists) throw new Error("Roster repair contract records are inconsistent.");
    newContract = buildInitialContract({ player: incomingPlayer, ownerUid: actorUid, leagueSeason: league.season, leagueStatus: league.status });
    const payrollAfter = contracts.filter((contract) => key(contract.playerId) !== key(dropPlayerId) && contract.ownerUid === actorUid).reduce((sum, contract) => sum + (isValidContract(contract) ? contract.salary : 0), 0) + newContract.salary;
    if (payrollAfter > getLeagueSalaryCap(league)) throw new Error("That replacement would exceed the salary cap.");
  }
  return { outgoing, roster: nextRoster, lineup, feasibility, newContract, readyMemberIds: (league.seasonReadyMemberIds || []).filter((uid) => uid !== actorUid) };
}
