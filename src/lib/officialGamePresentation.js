const EMPTY_STATS = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };

export function presentationStartedAtMs(game) {
  const startedAt = game?.presentation?.startedAt;
  if (typeof startedAt?.toMillis === "function") return startedAt.toMillis();
  if (typeof startedAt === "number") return startedAt;
  if (startedAt?.seconds) return startedAt.seconds * 1000;
  return null;
}

export function getPresentationFrame(game, nowMs = Date.now()) {
  const timeline = Array.isArray(game?.timeline) ? game.timeline : [];
  const startedAt = presentationStartedAtMs(game);
  if (!timeline.length || startedAt === null) {
    return { visibleEvents: [], currentEvent: null, finished: false, elapsedMs: 0 };
  }
  const elapsedMs = Math.max(0, nowMs - startedAt);
  const visibleEvents = timeline.filter(
    (event) => event.presentationOffsetMs <= elapsedMs,
  );
  const currentEvent = visibleEvents.at(-1) || null;
  return {
    visibleEvents,
    currentEvent,
    finished: currentEvent?.eventType === "game_end",
    elapsedMs,
  };
}

export function getProgressivePlayerStats(visibleEvents) {
  const totals = {};
  visibleEvents.forEach((event) => {
    (event.statDeltas || []).forEach(({ playerId, side, ...delta }) => {
      const key = `${side}:${playerId}`;
      const current = totals[key] || { ...EMPTY_STATS };
      totals[key] = Object.fromEntries(
        Object.keys(EMPTY_STATS).map((stat) => [stat, current[stat] + (delta[stat] || 0)]),
      );
    });
  });
  return totals;
}

export function presentationPhase(event) {
  if (!event) return "Q1";
  if (event.eventType === "game_end") return "FINAL";
  if (event.eventType === "halftime") return "HALFTIME";
  return `Q${event.quarter}`;
}
