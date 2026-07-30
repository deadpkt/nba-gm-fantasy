import assert from "node:assert/strict";
import test from "node:test";
import { draftTurnIdentity, formatDraftClock, getDraftRemainingSeconds } from "./draftTimer.js";

test("null and undefined Draft hydration state is inactive and safe", () => {
  assert.deepEqual(draftTurnIdentity(null), { pickNumber: null, drafterUid: null, deadlineMs: null });
  assert.deepEqual(draftTurnIdentity(undefined), { pickNumber: null, drafterUid: null, deadlineMs: null });
  assert.equal(getDraftRemainingSeconds(null), null);
  assert.equal(getDraftRemainingSeconds(undefined), null);
});

test("resolved and completed Draft states expose only persisted timer data", () => {
  assert.deepEqual(draftTurnIdentity({ currentPickNumber: 3, currentDrafterUid: "member-b", pickDeadlineAt: 100_000 }), { pickNumber: 3, drafterUid: "member-b", deadlineMs: 100_000 });
  assert.deepEqual(draftTurnIdentity({ status: "completed", currentPickNumber: 16, currentDrafterUid: null, pickDeadlineAt: null }), { pickNumber: 16, drafterUid: null, deadlineMs: null });
});

test("persisted deadline survives refresh and derives the same remaining time", () => {
  const deadline = 100_000;
  assert.equal(getDraftRemainingSeconds(deadline, 0, 10_000), 90);
  assert.equal(getDraftRemainingSeconds(deadline, 0, 53_200), 47);
  assert.equal(getDraftRemainingSeconds(deadline, 0, 54_100), 46);
});

test("clock formatting includes 01:30, low time, and zero", () => {
  assert.equal(formatDraftClock(90), "01:30");
  assert.equal(formatDraftClock(9), "00:09");
  assert.equal(formatDraftClock(0), "00:00");
});
