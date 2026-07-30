import assert from "node:assert/strict";
import test from "node:test";
import { buildDraftTurnWindow, DRAFT_PICK_DURATION_MS, DRAFT_PICK_DURATION_SECONDS, draftTurnIdentity, draftTurnMatches, isDraftTurnExpired, selectDeterministicAutoPick } from "../shared/draftTimer.js";

const player = (id, overall, positions, extra = {}) => ({ id, name: id, overall, active: true, draftEligible: true, primaryPosition: positions[0], eligiblePositions: positions, position: positions[0], ...extra });

test("unresolved Draft state has no turn identity or fabricated deadline", () => {
  assert.deepEqual(draftTurnIdentity(null), { pickNumber: null, drafterUid: null, deadlineMs: null });
  assert.deepEqual(draftTurnIdentity(undefined), { pickNumber: null, drafterUid: null, deadlineMs: null });
});

test("every Draft turn window is exactly 90 seconds and preserves its persisted deadline", () => {
  assert.equal(DRAFT_PICK_DURATION_SECONDS, 90);
  const first = buildDraftTurnWindow(1_000);
  assert.equal(first.pickDeadlineAtMs - first.pickStartedAtMs, DRAFT_PICK_DURATION_MS);
  assert.deepEqual(buildDraftTurnWindow(1_000), first);
  assert.equal(buildDraftTurnWindow(20_000).pickDeadlineAtMs, 110_000);
});

test("expiration and stale turn identity use authoritative values", () => {
  const draft = { currentPickNumber: 4, currentDrafterUid: "a", pickDeadlineAt: 91_000 };
  assert.equal(isDraftTurnExpired(draft.pickDeadlineAt, 90_999), false);
  assert.equal(isDraftTurnExpired(draft.pickDeadlineAt, 91_000), true);
  assert.equal(draftTurnMatches(draft, { pickNumber: 4, drafterUid: "a", deadlineMs: 91_000 }), true);
  assert.equal(draftTurnMatches(draft, { pickNumber: 3, drafterUid: "a", deadlineMs: 91_000 }), false);
});

test("auto-pick excludes owned, inactive, and ineligible players", () => {
  const result = selectDeterministicAutoPick({ candidates: [player("owned", 99, ["PG"]), player("inactive", 98, ["PG"], { active: false }), player("historical", 97, ["PG"], { draftEligible: false }), player("valid", 80, ["PG"])], roster: [], rosterSize: 8, ownedPlayerIds: new Set(["owned"]) });
  assert.equal(result.player.id, "valid");
});

test("higher OVR and then stable ID win when feasibility is equivalent", () => {
  const high = selectDeterministicAutoPick({ candidates: [player("b", 90, ["PG"]), player("a", 91, ["SG"])], roster: [], rosterSize: 8, ownedPlayerIds: new Set() });
  assert.equal(high.player.id, "a");
  const tie = selectDeterministicAutoPick({ candidates: [player("b", 90, ["PG"]), player("a", 90, ["SG"])], roster: [], rosterSize: 8, ownedPlayerIds: new Set() });
  assert.equal(tie.player.id, "a");
});

test("final missing-PG integrity beats a higher-rated center", () => {
  const roster = [player("sg", 80, ["SG"]), player("sf", 80, ["SF"]), player("pf", 80, ["PF"]), player("c", 80, ["C"]), player("b1", 80, ["C"]), player("b2", 80, ["PF"]), player("b3", 80, ["SF"])];
  const result = selectDeterministicAutoPick({ candidates: [player("elite-c", 99, ["C"]), player("needed-pg", 82, ["PG", "SG"])], roster, rosterSize: 8, ownedPlayerIds: new Set() });
  assert.equal(result.player.id, "needed-pg");
  assert.equal(result.feasibility.valid, true);
});

test("legacy five-player auto-pick also requires a legal final five", () => {
  const roster = [player("pg", 80, ["PG"]), player("sg", 80, ["SG"]), player("sf", 80, ["SF"]), player("pf", 80, ["PF"])];
  assert.equal(selectDeterministicAutoPick({ candidates: [player("wing", 95, ["SF"]), player("center", 75, ["C"])], roster, rosterSize: 5, ownedPlayerIds: new Set() }).player.id, "center");
});
