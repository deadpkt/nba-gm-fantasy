import assert from "node:assert/strict";
import test from "node:test";
import { filterAndSortFreeAgents, getMarketStatus, getPlayerSigningState } from "./freeAgencyPresentation.js";

const players = [
  { id: "a", name: "Alpha Guard", overall: 90, primaryPosition: "PG", eligiblePositions: ["PG", "SG"] },
  { id: "b", name: "Beta Center", overall: 96, primaryPosition: "C", eligiblePositions: ["C"] },
  { id: "c", name: "Court Wing", overall: 80, primaryPosition: "SF", eligiblePositions: ["SF", "PF"] },
];

test("search is name-only and position uses canonical eligibility", () => {
  assert.deepEqual(filterAndSortFreeAgents(players, { search: "guard", position: "ALL", sort: "overall" }).map((player) => player.id), ["a"]);
  assert.deepEqual(filterAndSortFreeAgents(players, { position: "SG", sort: "overall" }).map((player) => player.id), ["a"]);
});

test("market sorts use deterministic projected salary and stable fallbacks", () => {
  assert.deepEqual(filterAndSortFreeAgents(players, { position: "ALL", sort: "salary-asc" }).map((player) => player.id), ["c", "a", "b"]);
  assert.deepEqual(filterAndSortFreeAgents(players, { position: "ALL", sort: "salary-desc" }).map((player) => player.id), ["b", "a", "c"]);
});

test("roster-full state has priority over cap guidance", () => {
  assert.equal(getMarketStatus({ openRosterSlots: 0, capSpace: -1 }).label, "ROSTER FULL");
  assert.equal(getMarketStatus({ openRosterSlots: 1, capSpace: 22_000_000 }).label, "1 OPEN ROSTER SPOT");
});

test("signing state explains roster and cap blocks", () => {
  assert.deepEqual(getPlayerSigningState({ salary: 20_000_000, capSpace: 10_000_000, openRosterSlots: 1 }), { disabled: true, label: "OVER CAP", detail: "$10M over available cap space" });
  assert.equal(getPlayerSigningState({ salary: 11_000_000, capSpace: 20_000_000, openRosterSlots: 0 }).label, "ROSTER FULL");
  assert.equal(getPlayerSigningState({ salary: 11_000_000, capSpace: 20_000_000, openRosterSlots: 1 }).disabled, false);
});
