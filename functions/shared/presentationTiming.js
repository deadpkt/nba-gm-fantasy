export const OFFICIAL_PRESENTATION_DURATION_MS = 60000;

export function buildPresentationWindow(startedAtMs) {
  return {
    durationMs: OFFICIAL_PRESENTATION_DURATION_MS,
    startedAtMs,
    endsAtMs: startedAtMs + OFFICIAL_PRESENTATION_DURATION_MS,
  };
}

export function isPresentationDeadlineReached(presentation, nowMs) {
  const endsAt = presentation?.endsAt;
  const endsAtMs = typeof endsAt?.toMillis === "function"
    ? endsAt.toMillis()
    : typeof endsAt === "number"
      ? endsAt
      : endsAt?.seconds * 1000;
  return Number.isFinite(endsAtMs) && Number.isFinite(nowMs) && nowMs >= endsAtMs;
}
