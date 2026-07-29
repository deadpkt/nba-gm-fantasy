export const ROUND_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
});

export function createSeasonProgress(totalRounds) {
  return {
    currentRound: 1,
    roundStatus: ROUND_STATUS.PENDING,
    totalRounds,
    regularSeasonComplete: false,
  };
}

export function nextRoundToStart(progress) {
  if (!progress || progress.regularSeasonComplete) return null;
  if (progress.roundStatus === ROUND_STATUS.PENDING) return progress.currentRound;
  if (
    progress.roundStatus === ROUND_STATUS.COMPLETED &&
    progress.currentRound < progress.totalRounds
  ) {
    return progress.currentRound + 1;
  }
  return null;
}

export function isRoundCompleteAfterGame(games, completingGameId) {
  return games.length > 0 && games.every(
    (game) => game.id === completingGameId || game.status === "completed",
  );
}
