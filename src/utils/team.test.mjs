import assert from "node:assert/strict";
import test from "node:test";
import { buildLineupAssignment, getAssignableLineupPlayers, getLineupValidation, getPlayerEligiblePositions, isLineupComplete, isPlayerEligibleForPosition, LINEUP_POSITIONS, normalizeRosterLineup } from "./team.js";

const player = (id, primaryPosition, eligiblePositions = [primaryPosition]) => ({ id, name: id, position: primaryPosition, primaryPosition, eligiblePositions, overall: 75 });
const roster = [
  player("bdl_pg", "PG", ["PG", "SG"]),
  player("bdl_sg", "SG", ["SG", "SF"]),
  player("bdl_sf", "SF", ["SF", "PF"]),
  player("bdl_pf", "PF", ["PF", "C"]),
  player("bdl_c", "C", ["C"]),
];
const validLineup = { PG: "bdl_pg", SG: "bdl_sg", SF: "bdl_sf", PF: "bdl_pf", C: "bdl_c" };

test("bdl player assignment persists through lineup normalization", () => {
  const assigned = buildLineupAssignment(roster, {}, "PG", "bdl_pg");
  assert.equal(assigned.PG, "bdl_pg");
  assert.equal(normalizeRosterLineup(roster, assigned).PG, "bdl_pg");
});

test("all drafted roster players remain discoverable by an eligible court slot", () => {
  const visible = new Set(LINEUP_POSITIONS.flatMap((position) => getAssignableLineupPlayers(roster, {}, position).map((item) => item.id)));
  assert.deepEqual(visible, new Set(roster.map((item) => item.id)));
});

test("canonical position eligibility accepts only legal slots", () => {
  assert.equal(isPlayerEligibleForPosition(player("pg", "PG"), "PG"), true);
  assert.equal(isPlayerEligibleForPosition(player("pg", "PG"), "C"), false);
  assert.equal(isPlayerEligibleForPosition(player("guard", "PG", ["PG", "SG"]), "PG"), true);
  assert.equal(isPlayerEligibleForPosition(player("guard", "PG", ["PG", "SG"]), "SG"), true);
  assert.equal(isPlayerEligibleForPosition(player("big", "PF", ["PF", "C"]), "PF"), true);
  assert.equal(isPlayerEligibleForPosition(player("big", "PF", ["PF", "C"]), "C"), true);
  assert.equal(isPlayerEligibleForPosition(player("center", "C"), "PG"), false);
});

test("assignment rejects ineligible, duplicate, and non-roster usage", () => {
  assert.throws(() => buildLineupAssignment(roster, {}, "C", "bdl_pg"), /not eligible/);
  assert.throws(() => buildLineupAssignment(roster, {}, "PG", "not-rostered"), /not on/);
  const moved = buildLineupAssignment(roster, { ...validLineup, SG: "bdl_pg" }, "PG", "bdl_pg");
  assert.equal(moved.PG, "bdl_pg");
  assert.equal(moved.SG, null);
});

test("legacy snapshots normalize safely while invalid old lineups remain not ready", () => {
  const legacy = [player(1, "PG"), player(2, "SG"), player(3, "SF"), player(4, "PF"), { id: 5, name: "Legacy C", position: "C", overall: 75 }];
  assert.deepEqual(getPlayerEligiblePositions(legacy[4]), ["C"]);
  assert.equal(normalizeRosterLineup(legacy, { PG: "1" }).PG, 1);
  const invalid = { PG: 1, SG: 2, SF: 3, PF: 4, C: 1 };
  assert.equal(getLineupValidation(legacy, invalid).valid, false);
  assert.equal(isLineupComplete(legacy, invalid), false);
});

test("complete canonical lineup is season ready", () => {
  assert.equal(isLineupComplete(roster, validLineup), true);
});

test("eight roster players still produce exactly one valid five-player Starting Five", () => {
  const expanded = [...roster, player("bench_pg", "PG"), player("bench_sf", "SF"), player("bench_c", "C")];
  assert.equal(getLineupValidation(expanded, validLineup).valid, true);
  assert.equal(getLineupValidation(expanded, validLineup).players.length, 5);
  assert.equal(getAssignableLineupPlayers(expanded, validLineup, "PG").some((item) => item.id === "bench_pg"), true);
});
