import { performance } from "node:perf_hooks";
import { simulateOfficialGameV2, serializedV2GameSize } from "../functions/shared/officialSimulationV2.js";
import { v2Input, v2Players } from "../functions/test/simulationV2Fixtures.js";

const argument = process.argv.find((value) => value.startsWith("--games="));
const games = argument ? Number(argument.split("=")[1]) : process.argv.includes("--release") ? 25_000 : process.argv.includes("--ci") ? 250 : 5_000;
if (!Number.isInteger(games) || games < 1) throw new Error("Use --games=<positive integer>.");
const scenarios = [
  ["identical_balanced", () => [v2Players("H", 75), v2Players("A", 75)]],
  ["elite_balanced", () => [v2Players("H", 82), v2Players("A", 75)]],
  ["replacement_level", () => [v2Players("H", 75), v2Players("A", 68)]],
  ["elite_shooters_vs_weak_perimeter", () => [v2Players("H", 75, { threePoint: 94 }), v2Players("A", 75, { perimeterDefense: 42 })]],
  ["paint_vs_weak_rim", () => [v2Players("H", 75, { rimScoring: 94 }), v2Players("A", 75, { interiorDefense: 42, block: 38 })]],
  ["rim_protection_vs_paint", () => [v2Players("H", 75, { interiorDefense: 94, block: 94 }), v2Players("A", 75, { rimScoring: 92 })]],
  ["playmaker_vs_pressure", () => [v2Players("H", 75, { PG: { playmaking: 96, ballHandling: 95, turnoverControl: 94 } }), v2Players("A", 75, { perimeterDefense: 88, steal: 86 })]],
  ["rebounding_advantage", () => [v2Players("H", 75, { offensiveRebounding: 90, defensiveRebounding: 90 }), v2Players("A", 75, { offensiveRebounding: 45, defensiveRebounding: 45 })]],
  ["poor_fit_high_ovr", () => [v2Players("H", 80, { playmaking: 42, ballHandling: 45, perimeterDefense: 45, interiorDefense: 45 }), v2Players("A", 77)]],
  ["balanced_lower_talent", () => [v2Players("H", 77), v2Players("A", 80, { playmaking: 42, ballHandling: 45, perimeterDefense: 45, interiorDefense: 45 })]],
  ["one_star", () => [v2Players("H", 66, { PG: Object.fromEntries(["overall", "rimScoring", "midRange", "threePoint", "playmaking", "ballHandling", "turnoverControl", "consistency"].map((key) => [key, 96])) }), v2Players("A", 75)]],
  ["multiple_creators", () => [v2Players("H", 75, { PG: { playmaking: 92 }, SG: { playmaking: 88 }, SF: { playmaking: 84 } }), v2Players("A", 75)]],
  ["fast_pace", () => [v2Players("H", 78, { athleticism: 92 }), v2Players("A", 75), { home: { offense: "PACE_AND_SPACE", defense: "BALANCED" } }]],
  ["slow_defense", () => [v2Players("H", 78, { perimeterDefense: 90, interiorDefense: 90 }), v2Players("A", 75)]],
];
const started = performance.now();
for (const [name, fixture] of scenarios) {
  let wins = 0, homePoints = 0, awayPoints = 0, threes = 0, turnovers = 0, overtime = 0, largest = 0;
  for (let index = 0; index < games; index += 1) {
    const [home, away, strategies = {}] = fixture(); const simulation = simulateOfficialGameV2(v2Input(`${name}-${index}`, home, away, strategies));
    wins += simulation.result.winnerUid === "home" ? 1 : 0; homePoints += simulation.result.homeScore; awayPoints += simulation.result.awayScore; threes += simulation.boxScore.home.teamStats.threesAttempted; turnovers += simulation.boxScore.home.teamStats.turnovers; overtime += simulation.metrics.overtimePeriods > 0 ? 1 : 0; largest = Math.max(largest, serializedV2GameSize(simulation));
  }
  console.log(`${name}: homeWin=${(wins / games * 100).toFixed(1)}% score=${(homePoints / games).toFixed(1)}-${(awayPoints / games).toFixed(1)} 3PA=${(threes / games).toFixed(1)} TO=${(turnovers / games).toFixed(1)} OT=${(overtime / games * 100).toFixed(1)}% maxBytes=${largest}`);
}
console.log(`Simulation V2 calibration complete: ${scenarios.length * games} games in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
