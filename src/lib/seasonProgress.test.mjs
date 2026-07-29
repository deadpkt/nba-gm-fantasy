import assert from "node:assert/strict";
import test from "node:test";
import {
  createSeasonProgress,
  isRoundCompleteAfterGame,
  nextRoundToStart,
  ROUND_STATUS,
} from "./seasonProgress.js";

test("season starts with round one pending", () => {
  assert.deepEqual(createSeasonProgress(12), {
    currentRound: 1,
    roundStatus: ROUND_STATUS.PENDING,
    totalRounds: 12,
    regularSeasonComplete: false,
  });
});

test("round completes only when all scheduled games are final", () => {
  const games = [
    { id: "game-1", status: "in_progress" },
    { id: "game-2", status: "completed" },
  ];
  assert.equal(isRoundCompleteAfterGame(games, "game-1"), true);
  assert.equal(isRoundCompleteAfterGame(games, "another-game"), false);
});

test("only pending or completed non-final rounds can start", () => {
  assert.equal(nextRoundToStart(createSeasonProgress(3)), 1);
  assert.equal(nextRoundToStart({ currentRound: 1, totalRounds: 3, roundStatus: ROUND_STATUS.ACTIVE, regularSeasonComplete: false }), null);
  assert.equal(nextRoundToStart({ currentRound: 1, totalRounds: 3, roundStatus: ROUND_STATUS.COMPLETED, regularSeasonComplete: false }), 2);
  assert.equal(nextRoundToStart({ currentRound: 3, totalRounds: 3, roundStatus: ROUND_STATUS.COMPLETED, regularSeasonComplete: true }), null);
});
