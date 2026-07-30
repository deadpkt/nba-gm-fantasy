import assert from "node:assert/strict";
import test from "node:test";
import { validateStartingLineup } from "../shared/lineup.js";

const roster = ["PG", "SG", "SF", "PF", "C"].map((position) => ({ id: `bdl_${position}`, name: position, position, primaryPosition: position, eligiblePositions: [position] }));
const lineup = Object.fromEntries(roster.map((player) => [player.position, player.id]));

test("trusted lineup validation accepts canonical string IDs", () => {
  assert.equal(validateStartingLineup({ roster, lineup }).valid, true);
});

test("trusted lineup validation rejects illegal positions, duplicates, and outsiders", () => {
  assert.equal(validateStartingLineup({ roster, lineup: { ...lineup, C: "bdl_PG" } }).valid, false);
  assert.equal(validateStartingLineup({ roster, lineup: { ...lineup, C: "bdl_unknown" } }).valid, false);
});

test("trusted lineup validation supports legacy numeric IDs and position fields", () => {
  const legacyRoster = ["PG", "SG", "SF", "PF", "C"].map((position, index) => ({ id: index + 1, position }));
  const legacyLineup = Object.fromEntries(legacyRoster.map((player) => [player.position, String(player.id)]));
  assert.equal(validateStartingLineup({ roster: legacyRoster, lineup: legacyLineup }).valid, true);
});

test("trusted lineup validation accepts an eight-player roster but returns only five starters", () => {
  const expanded = [...roster, { id: "bench-1", position: "PG" }, { id: "bench-2", position: "SF" }, { id: "bench-3", position: "C" }];
  const result = validateStartingLineup({ roster: expanded, lineup }, 8);
  assert.equal(result.valid, true);
  assert.equal(result.players.length, 5);
  assert.equal(result.players.some((player) => player.id.startsWith("bench-")), false);
});

test("a bench player may legally replace a starter without changing the five-player invariant", () => {
  const expanded = [...roster, { id: "bench-pg", position: "PG", primaryPosition: "PG", eligiblePositions: ["PG"] }, { id: "bench-sf", position: "SF" }, { id: "bench-c", position: "C" }];
  const result = validateStartingLineup({ roster: expanded, lineup: { ...lineup, PG: "bench-pg" } }, 8);
  assert.equal(result.valid, true);
  assert.equal(result.players[0].id, "bench-pg");
});
