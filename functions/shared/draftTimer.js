import { getDraftRosterFeasibility } from "./lineupFeasibility.js";

export const DRAFT_PICK_DURATION_SECONDS = 90;
export const DRAFT_PICK_DURATION_MS = DRAFT_PICK_DURATION_SECONDS * 1000;

const millis = (value) => {
  if (value == null) return null;
  const result = typeof value?.toMillis === "function" ? value.toMillis() : Number(value);
  return Number.isFinite(result) ? result : null;
};

export function buildDraftTurnWindow(startedAtMs) {
  return { pickStartedAtMs: startedAtMs, pickDeadlineAtMs: startedAtMs + DRAFT_PICK_DURATION_MS };
}

export function isDraftTurnExpired(deadline, nowMs) {
  return Number.isFinite(millis(deadline)) && nowMs >= millis(deadline);
}

export function draftTurnIdentity(draft = {}) {
  if (!draft) {
    return { pickNumber: null, drafterUid: null, deadlineMs: null };
  }
  return {
    pickNumber: draft.currentPickNumber ?? null,
    drafterUid: draft.currentDrafterUid ?? null,
    deadlineMs: millis(draft.pickDeadlineAt),
  };
}

export function draftTurnMatches(draft, expected = {}) {
  const current = draftTurnIdentity(draft);
  return current.pickNumber === expected.pickNumber
    && current.drafterUid === expected.drafterUid
    && current.deadlineMs === expected.deadlineMs;
}

export function selectDeterministicAutoPick({ candidates = [], roster = [], rosterSize, ownedPlayerIds = new Set() }) {
  return candidates
    .filter((player) => player?.active === true && player?.draftEligible === true && !ownedPlayerIds.has(String(player.id)))
    .map((player) => ({ player, feasibility: getDraftRosterFeasibility([...roster, player], rosterSize) }))
    .filter(({ feasibility }) => feasibility.canStillBecomeValid)
    .sort((first, second) => second.player.overall - first.player.overall || String(first.player.id).localeCompare(String(second.player.id)))[0] || null;
}
