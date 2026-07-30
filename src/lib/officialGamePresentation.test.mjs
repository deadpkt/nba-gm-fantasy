import assert from "node:assert/strict";
import test from "node:test";
import { getAuthoritativePresentationFrame, getPresentationFrame, isOfficialGameFinalVisible } from "./officialGamePresentation.js";

const liveGame = {
  status: "in_progress",
  presentation: { startedAt: 1_000, durationMs: 60_000 },
  timeline: [
    { sequence: 1, eventType: "tipoff", presentationOffsetMs: 0 },
    { sequence: 2, eventType: "game_end", presentationOffsetMs: 60_000 },
  ],
  result: { homeScore: 101, awayScore: 99 },
};

test("persisted result remains hidden before game_end and across refresh", () => {
  assert.equal(getPresentationFrame(liveGame, 60_999).finished, false);
  assert.equal(isOfficialGameFinalVisible(liveGame, 60_999), false);
  assert.equal(isOfficialGameFinalVisible({ ...liveGame }, 60_999), false);
});

test("final result requires both game_end timing and trusted completed status", () => {
  assert.equal(getPresentationFrame(liveGame, 61_000).finished, true);
  assert.equal(isOfficialGameFinalVisible(liveGame, 61_000), false);
  assert.equal(isOfficialGameFinalVisible({ ...liveGame, status: "completed", presentationCompletedAt: 61_000 }, 61_000), true);
});

test("historical completed games without presentation metadata remain visible", () => {
  assert.equal(isOfficialGameFinalVisible({ status: "completed", result: liveGame.result }), true);
});

test("two viewers and a refreshed viewer share the persisted authoritative position", () => {
  const viewerA = getAuthoritativePresentationFrame(liveGame, 21_000);
  const viewerB = getAuthoritativePresentationFrame(liveGame, 21_000);
  const refreshed = getAuthoritativePresentationFrame({ ...liveGame }, 21_000);
  assert.deepEqual(viewerB, viewerA);
  assert.deepEqual(refreshed, viewerA);
});
