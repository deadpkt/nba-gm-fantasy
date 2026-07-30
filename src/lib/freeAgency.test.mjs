import assert from "node:assert/strict";
import test from "node:test";
import { filterUnownedPlayers } from "./freeAgencyPool.js";

test("ownership changes update the free-agent pool without changing catalog data", () => {
  const catalog = [
    { id: "a", active: true, draftEligible: true },
    { id: "b", active: true, draftEligible: true },
    { id: "old", active: false, draftEligible: false },
  ];
  assert.deepEqual(filterUnownedPlayers(catalog, new Set(["a"])).map((player) => player.id), ["b"]);
  assert.deepEqual(filterUnownedPlayers(catalog, new Set(["b"])).map((player) => player.id), ["a"]);
  assert.equal(catalog.length, 3);
});
