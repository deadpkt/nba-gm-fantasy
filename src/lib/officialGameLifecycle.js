export const OFFICIAL_GAME_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
});

export function getOfficialParticipantSide(game, authenticatedUid) {
  if (!authenticatedUid) return null;
  if (game?.homeUid === authenticatedUid) return "home";
  if (game?.awayUid === authenticatedUid) return "away";
  return null;
}

export function isLegalOfficialGameTransition(from, to) {
  return (
    (from === OFFICIAL_GAME_STATUS.SCHEDULED &&
      to === OFFICIAL_GAME_STATUS.IN_PROGRESS) ||
    (from === OFFICIAL_GAME_STATUS.READY &&
      to === OFFICIAL_GAME_STATUS.IN_PROGRESS) ||
    (from === OFFICIAL_GAME_STATUS.IN_PROGRESS &&
      to === OFFICIAL_GAME_STATUS.COMPLETED)
  );
}
