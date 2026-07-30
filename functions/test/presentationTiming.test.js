import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPresentationWindow,
  isPresentationDeadlineReached,
  OFFICIAL_PRESENTATION_DURATION_MS,
} from "../shared/presentationTiming.js";

test("official presentation authority is exactly one minute", () => {
  assert.equal(OFFICIAL_PRESENTATION_DURATION_MS, 60000);
  assert.deepEqual(buildPresentationWindow(10_000), {
    durationMs: 60000,
    startedAtMs: 10_000,
    endsAtMs: 70_000,
  });
});

test("trusted deadline logic locks before and unlocks at the persisted endpoint", () => {
  const presentation = { endsAt: 70000 };
  assert.equal(isPresentationDeadlineReached(presentation, 69999), false);
  assert.equal(isPresentationDeadlineReached(presentation, 70000), true);
});

test("every game activated with one round timestamp receives the same window", () => {
  const games = ["g1", "g2", "g3", "g4"].map(() => buildPresentationWindow(10_000));
  assert.equal(new Set(games.map((game) => game.startedAtMs)).size, 1);
  assert.equal(new Set(games.map((game) => game.endsAtMs)).size, 1);
  assert.equal(games[0].endsAtMs, 70_000);
});
