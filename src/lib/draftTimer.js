export { DRAFT_PICK_DURATION_MS, DRAFT_PICK_DURATION_SECONDS, draftTurnIdentity } from "../../functions/shared/draftTimer.js";

export function getDraftRemainingSeconds(deadline, serverTimeOffsetMs = 0, localNowMs = Date.now()) {
  if (deadline == null) return null;
  const deadlineMs = typeof deadline?.toMillis === "function" ? deadline.toMillis() : Number(deadline);
  if (!Number.isFinite(deadlineMs)) return null;
  return Math.max(0, Math.ceil((deadlineMs - (localNowMs + serverTimeOffsetMs)) / 1000));
}

export function formatDraftClock(seconds) {
  if (!Number.isInteger(seconds)) return "--:--";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
