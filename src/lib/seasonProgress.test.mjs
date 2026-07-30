import assert from "node:assert/strict";
import test from "node:test";
import {
  createSeasonProgress,
  isRoundCompleteAfterGame,
  isRoundProgressionComplete,
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

test("presentation-backed games unlock progression only after trusted completion", () => {
  const liveResult = { status: "in_progress", result: { homeScore: 100 }, timeline: [{ eventType: "game_end" }], presentation: { startedAt: 1 } };
  const prematurelyCompleted = { ...liveResult, status: "completed" };
  const authoritativelyCompleted = { ...prematurelyCompleted, presentationCompletedAt: 2 };
  assert.equal(isRoundProgressionComplete([liveResult]), false);
  assert.equal(isRoundProgressionComplete([prematurelyCompleted]), false);
  assert.equal(isRoundProgressionComplete([authoritativelyCompleted]), true);
  assert.equal(isRoundProgressionComplete([{ status: "completed" }]), true);
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
