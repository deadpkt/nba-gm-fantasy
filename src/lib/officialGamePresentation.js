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

export function getAuthoritativePresentationFrame(game, nowMs = Date.now()) {
  return getPresentationFrame(game, nowMs);
}

export function isOfficialGameFinalVisible(game, nowMs = Date.now()) {
  if (game?.status !== "completed") return false;
  const hasPresentation = Array.isArray(game?.timeline) && game.timeline.length > 0 && presentationStartedAtMs(game) !== null;
  // Historical completed games without presentation metadata remain readable.
  return !hasPresentation || getAuthoritativePresentationFrame(game, nowMs).finished;
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

const EVENT_LABELS = {
  made_2pt: "Made basket",
  made_3pt: "Made three-pointer",
  missed_shot: "Missed shot",
  free_throw: "Free throw",
  rebound: "Rebound",
  steal: "Steal",
  block: "Blocked shot",
  turnover: "Turnover",
  quarter_end: "End of quarter",
  halftime: "Halftime",
  game_end: "Final buzzer",
  tipoff: "Opening tip",
};

export function eventCategory(event) {
  if (!event) return "general";
  if (["made_2pt", "made_3pt", "free_throw"].includes(event.eventType)) return "score";
  if (event.eventType === "quarter_end" || event.eventType === "halftime" || event.eventType === "game_end") return "break";
  if (["rebound", "steal", "block", "turnover", "missed_shot"].includes(event.eventType)) return event.eventType;
  return "general";
}

export function formatGameEvent(event, { playersById = new Map(), game } = {}) {
  if (!event) return null;
  const player = playersById.get(String(event.playerId));
  const teamName = event.offenseUid === game?.homeUid
    ? game.homeTeamName
    : event.offenseUid === game?.awayUid
      ? game.awayTeamName
      : "";
  const safeText = typeof event.text === "string" && event.text.trim()
    ? event.text.trim()
    : player?.name
      ? `${player.name}: ${EVENT_LABELS[event.eventType] || "Play completed"}.`
      : EVENT_LABELS[event.eventType] || "Play completed.";
  return {
    title: safeText,
    detail: teamName,
    clock: event.gameClock || "--:--",
    phase: presentationPhase(event),
    type: eventCategory(event),
    scoreDelta: Number(event.pointsScored) || 0,
    teamUid: event.offenseUid || null,
    playerName: player?.name || null,
  };
}

export function getRecentScoringRun(events = [], game, limit = 8) {
  const scoring = events.filter((event) => Number(event.pointsScored) > 0).slice(-limit);
  return scoring.reduce((run, event) => {
    if (event.offenseUid === game?.homeUid) run.home += Number(event.pointsScored);
    if (event.offenseUid === game?.awayUid) run.away += Number(event.pointsScored);
    return run;
  }, { home: 0, away: 0 });
}
