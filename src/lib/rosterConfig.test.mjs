import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_ROSTER_CONFIG, getDraftPickTotal, getLeagueSalaryCap, getRosterCapacity, isDraftPickTotalComplete, normalizeRosterConfig, STARTER_COUNT } from "./rosterConfig.js";

const currentLeague = { rosterConfig: { ...CURRENT_ROSTER_CONFIG } };

test("new leagues normalize to an eight-player roster with five starters and three bench players", () => {
  assert.deepEqual(normalizeRosterConfig(currentLeague), CURRENT_ROSTER_CONFIG);
  assert.equal(getLeagueSalaryCap(currentLeague), 140_000_000);
});

test("legacy leagues without configuration retain five-player and 100M behavior", () => {
  assert.deepEqual(normalizeRosterConfig({}), { version: 1, rosterSize: 5, starterCount: 5, benchSize: 0 });
  assert.equal(getLeagueSalaryCap({}), 100_000_000);
});

test("draft totals scale deterministically by league membership", () => {
  assert.equal(getDraftPickTotal(currentLeague, 2), 16);
  assert.equal(getDraftPickTotal(currentLeague, 4), 32);
  assert.equal(getDraftPickTotal(currentLeague, 8), 64);
  assert.equal(getDraftPickTotal({}, 2), 10);
  assert.equal(isDraftPickTotalComplete(currentLeague, 2, 10), false);
  assert.equal(isDraftPickTotalComplete(currentLeague, 2, 15), false);
  assert.equal(isDraftPickTotalComplete(currentLeague, 2, 16), true);
});

test("roster capacity follows league version without changing the Starting Five", () => {
  assert.deepEqual(getRosterCapacity(currentLeague, Array(7)), {
    rosterSize: 8,
    currentRosterCount: 7,
    openRosterSlots: 1,
  });
  assert.deepEqual(getRosterCapacity({}, Array(5)), {
    rosterSize: 5,
    currentRosterCount: 5,
    openRosterSlots: 0,
  });
  assert.equal(STARTER_COUNT, 5);
});

test("roster capacity safely clamps full and malformed roster values", () => {
  assert.equal(getRosterCapacity(currentLeague, Array(9)).openRosterSlots, 0);
  assert.deepEqual(getRosterCapacity(currentLeague, null), {
    rosterSize: 8,
    currentRosterCount: 0,
    openRosterSlots: 8,
  });
});
