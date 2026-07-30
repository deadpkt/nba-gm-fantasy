import assert from "node:assert/strict";
import test from "node:test";
import { canBuildLegalStartingFive, getDraftRosterFeasibility } from "../shared/lineupFeasibility.js";

const player = (id, eligiblePositions) => ({ id, name: id, eligiblePositions, primaryPosition: eligiblePositions[0], position: eligiblePositions.join("/") });

test("a canonical five-position roster produces a unique assignment", () => {
  const result = canBuildLegalStartingFive([player("pg", ["PG"]), player("sg", ["SG"]), player("sf", ["SF"]), player("pf", ["PF"]), player("c", ["C"])]);
  assert.equal(result.valid, true);
  assert.equal(new Set(Object.values(result.assignment)).size, 5);
});

test("missing point guard and center are reported", () => {
  const noPg = canBuildLegalStartingFive([player("sg1", ["SG"]), player("sg2", ["SG"]), player("sf", ["SF"]), player("pf", ["PF"]), player("c", ["C"])]);
  const noC = canBuildLegalStartingFive([player("pg", ["PG"]), player("sg", ["SG"]), player("sf", ["SF"]), player("pf1", ["PF"]), player("pf2", ["PF"])]);
  assert.equal(noPg.valid, false);
  assert.ok(noPg.uncoveredPositions.includes("PG"));
  assert.equal(noC.valid, false);
  assert.ok(noC.uncoveredPositions.includes("C"));
});

test("combo positions use actual unique-player matching", () => {
  const result = canBuildLegalStartingFive([
    player("g1", ["PG", "SG"]), player("g2", ["PG", "SG"]), player("wing", ["SG", "SF"]),
    player("forward", ["SF", "PF"]), player("big", ["PF", "C"]),
  ]);
  assert.equal(result.valid, true);
  assert.equal(new Set(Object.values(result.assignment)).size, 5);
  const overlap = canBuildLegalStartingFive([player("only-guard", ["PG", "SG"]), player("sf", ["SF"]), player("pf", ["PF"]), player("c", ["C"])]);
  assert.equal(overlap.valid, false);
  assert.equal(overlap.matchedCount, 4);
});

test("early picks remain open while mathematically impossible late picks are rejected", () => {
  const early = getDraftRosterFeasibility([player("c1", ["C"]), player("c2", ["C"])], 8);
  assert.equal(early.canStillBecomeValid, true);
  const sevenWithoutGuard = [player("sf", ["SF"]), player("pf", ["PF"]), player("c", ["C"]), player("b1", ["C"]), player("b2", ["PF"]), player("b3", ["SF"]), player("b4", ["C"])];
  assert.equal(getDraftRosterFeasibility([...sevenWithoutGuard, player("final-c", ["C"])], 8).canStillBecomeValid, false);
  assert.equal(getDraftRosterFeasibility([...sevenWithoutGuard, player("final-g", ["PG", "SG"])], 8).canStillBecomeValid, false);
  const sevenWithSg = [...sevenWithoutGuard.slice(0, 6), player("sg", ["SG"])];
  assert.equal(getDraftRosterFeasibility([...sevenWithSg, player("final-pg", ["PG"])], 8).valid, true);
});
