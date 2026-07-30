import { getPlayerEligiblePositions, LINEUP_POSITIONS } from "./lineup.js";

const playerKey = (player, index) => String(player?.id ?? `index-${index}`);

export function canBuildLegalStartingFive(roster = []) {
  const players = Array.isArray(roster) ? roster : [];
  const matchedPositionByPlayer = new Map();
  const matchedPlayerByPosition = new Map();

  function assign(position, visitedPlayers) {
    for (let index = 0; index < players.length; index += 1) {
      if (!getPlayerEligiblePositions(players[index]).includes(position)) continue;
      const key = playerKey(players[index], index);
      if (visitedPlayers.has(key)) continue;
      visitedPlayers.add(key);
      const previousPosition = matchedPositionByPlayer.get(key);
      if (!previousPosition || assign(previousPosition, visitedPlayers)) {
        matchedPositionByPlayer.set(key, position);
        matchedPlayerByPosition.set(position, players[index]);
        return true;
      }
    }
    return false;
  }

  LINEUP_POSITIONS.forEach((position) => assign(position, new Set()));
  const assignment = Object.fromEntries(LINEUP_POSITIONS.map((position) => [position, matchedPlayerByPosition.get(position)?.id ?? null]));
  const uncoveredPositions = LINEUP_POSITIONS.filter((position) => !matchedPlayerByPosition.has(position));
  return {
    valid: uncoveredPositions.length === 0,
    assignment,
    uncoveredPositions,
    matchedCount: LINEUP_POSITIONS.length - uncoveredPositions.length,
  };
}

export function getDraftRosterFeasibility(roster = [], rosterSize = 5) {
  const result = canBuildLegalStartingFive(roster);
  const remainingSlots = Math.max(0, rosterSize - roster.length);
  const minimumAdditionalPlayers = LINEUP_POSITIONS.length - result.matchedCount;
  return {
    ...result,
    remainingSlots,
    minimumAdditionalPlayers,
    canStillBecomeValid: result.valid || minimumAdditionalPlayers <= remainingSlots,
  };
}
