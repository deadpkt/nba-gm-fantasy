import { getInitialSalary } from "../../functions/shared/contracts.js";

export function freeAgentPositions(player = {}) {
  return player.eligiblePositions?.length
    ? player.eligiblePositions
    : [player.primaryPosition || player.position].filter(Boolean);
}

export function freeAgentTeamName(player = {}) {
  return player.team || player.nbaTeam?.fullName || player.providerData?.nbaTeam?.fullName || "NBA Free Agent";
}

export function filterAndSortFreeAgents(players = [], filters = {}) {
  const search = String(filters.search || "").trim().toLocaleLowerCase();
  const position = filters.position || "ALL";
  const result = players.filter((player) =>
    (!search || String(player.name || "").toLocaleLowerCase().includes(search)) &&
    (position === "ALL" || freeAgentPositions(player).includes(position)));
  return result.toSorted((first, second) => {
    if (filters.sort === "salary-asc") return getInitialSalary(first.overall) - getInitialSalary(second.overall) || second.overall - first.overall;
    if (filters.sort === "salary-desc") return getInitialSalary(second.overall) - getInitialSalary(first.overall) || second.overall - first.overall;
    if (filters.sort === "name") return first.name.localeCompare(second.name);
    if (filters.sort === "position") return (first.primaryPosition || first.position || "").localeCompare(second.primaryPosition || second.position || "") || second.overall - first.overall;
    return second.overall - first.overall || first.name.localeCompare(second.name);
  });
}

export function getMarketStatus({ openRosterSlots = 0, capSpace = 0 }) {
  if (openRosterSlots <= 0) return { label: "ROSTER FULL", detail: "Release a player from My Team to open a roster spot.", tone: "blocked" };
  if (capSpace < 0) return { label: "OVER CAP", detail: "Your franchise must clear salary before signing.", tone: "blocked" };
  return {
    label: `${openRosterSlots} OPEN ROSTER ${openRosterSlots === 1 ? "SPOT" : "SPOTS"}`,
    detail: `$${capSpace / 1_000_000}M in cap space available.`,
    tone: "open",
  };
}

export function getPlayerSigningState({ salary, capSpace, openRosterSlots, signing = false }) {
  if (signing) return { disabled: true, label: "SIGNING...", detail: "Trusted signing in progress" };
  if (openRosterSlots <= 0) return { disabled: true, label: "ROSTER FULL", detail: "Release a player to open a roster spot" };
  if (salary > capSpace) return { disabled: true, label: "OVER CAP", detail: `$${(salary - capSpace) / 1_000_000}M over available cap space` };
  return { disabled: false, label: "SIGN", detail: "Eligible to sign" };
}
