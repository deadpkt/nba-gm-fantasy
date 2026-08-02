import assert from "node:assert/strict";
import test from "node:test";
import { simulateOfficialGameV2 } from "../shared/officialSimulationV2.js";
import { v2Input, v2Players } from "./simulationV2Fixtures.js";

function runBatch({ count, prefix, home, away }) {
  const aggregate = { wins: 0, homeScore: 0, awayScore: 0, home: {}, away: {} };
  for (let index = 0; index < count; index += 1) {
    const simulation = simulateOfficialGameV2(v2Input(`${prefix}-${index}`, home(), away()));
    aggregate.wins += simulation.result.winnerUid === "home" ? 1 : 0; aggregate.homeScore += simulation.result.homeScore; aggregate.awayScore += simulation.result.awayScore;
    for (const side of ["home", "away"]) simulation.boxScore[side].players.forEach((player) => {
      aggregate[side][player.position] ||= {};
      Object.entries(player.stats).forEach(([key, value]) => { aggregate[side][player.position][key] = (aggregate[side][player.position][key] || 0) + value; });
    });
  }
  return { ...aggregate, winRate: aggregate.wins / count, homeAverage: aggregate.homeScore / count, awayAverage: aggregate.awayScore / count };
}

test("250-seed strength calibration meets fairness and upset targets", () => {
  const equal = runBatch({ count: 250, prefix: "equal", home: () => v2Players("H", 75), away: () => v2Players("A", 75) });
  const moderate = runBatch({ count: 250, prefix: "moderate", home: () => v2Players("H", 77), away: () => v2Players("A", 75) });
  const major = runBatch({ count: 250, prefix: "major", home: () => v2Players("H", 80), away: () => v2Players("A", 75) });
  assert.ok(equal.winRate >= .47 && equal.winRate <= .53, `equal=${equal.winRate}`);
  assert.ok(moderate.winRate >= .60 && moderate.winRate <= .70, `moderate=${moderate.winRate}`);
  assert.ok(major.winRate >= .70 && major.winRate <= .86, `major=${major.winRate}`);
  assert.ok(equal.homeAverage >= 50 && equal.homeAverage <= 82); assert.ok(equal.awayAverage >= 50 && equal.awayAverage <= 82);
});

test("specialists lead their relevant long-run categories", () => {
  const shooters = runBatch({ count: 100, prefix: "shooters", home: () => v2Players("H", 70, { SG: { threePoint: 98, consistency: 92 } }), away: () => v2Players("A", 70, { SG: { threePoint: 42 } }) });
  assert.ok(shooters.home.SG.threesAttempted > shooters.away.SG.threesAttempted); assert.ok(shooters.home.SG.threesMade / shooters.home.SG.threesAttempted > shooters.away.SG.threesMade / shooters.away.SG.threesAttempted);
  const creators = runBatch({ count: 100, prefix: "creators", home: () => v2Players("H", 70, { PG: { playmaking: 98, ballHandling: 96, turnoverControl: 96 } }), away: () => v2Players("A", 70, { PG: { playmaking: 45, ballHandling: 48, turnoverControl: 45 } }) });
  assert.ok(creators.home.PG.assists > creators.away.PG.assists);
  assert.ok(Object.values(creators.home).reduce((total, stats) => total + stats.turnovers, 0) < Object.values(creators.away).reduce((total, stats) => total + stats.turnovers, 0));
  const rebounders = runBatch({ count: 100, prefix: "rebounders", home: () => v2Players("H", 70, { C: { offensiveRebounding: 98, defensiveRebounding: 98, athleticism: 90 } }), away: () => v2Players("A", 70, { C: { offensiveRebounding: 40, defensiveRebounding: 40 } }) });
  assert.ok(rebounders.home.C.rebounds > rebounders.away.C.rebounds);
  const rim = runBatch({ count: 100, prefix: "rim", home: () => v2Players("H", 70, { C: { interiorDefense: 98, block: 98 } }), away: () => v2Players("A", 70, { rimScoring: 90 }) });
  assert.ok(rim.home.C.blocks > rim.away.C.blocks);
});
