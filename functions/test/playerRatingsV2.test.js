import assert from "node:assert/strict";
import test from "node:test";
import { RATINGS_VERSION_V1, SIMULATION_VERSION_V1, resolveLeagueEngineVersions } from "../shared/engineVersions.js";
import { buildLeaguePlayerSnapshot, normalizeLeaguePlayerSnapshot } from "../shared/playerSnapshot.js";
import { buildRatingsCoverageReport, snapshotsShareGameplayShape } from "../shared/ratingCoverage.js";
import { calculatePositionOverall, generatePlayerRatings, hasVerifiedRatingsV2, isValidRatingsV2, normalizeCanonicalPlayerRatings, V2_RATING_KEYS } from "../shared/playerRatingsV2.js";
import { normalizeSeasonStatRecord } from "../shared/seasonStats.js";
import { simulateOfficialGame } from "../lib/completeOfficialGame.js";
import { buildFreeAgentSigning } from "../shared/freeAgency.js";

const stats = (changes = {}) => ({ provider: "fixture", externalPlayerId: "1", season: "2025-26", gamesPlayed: 75, gamesStarted: 75, minutesPerGame: 34, pointsPerGame: 22, assistsPerGame: 5, turnoversPerGame: 2.2, fieldGoalPercentage: .48, threePointPercentage: .37, threePointAttemptsPerGame: 6, freeThrowPercentage: .82, freeThrowAttemptsPerGame: 5, offensiveReboundsPerGame: 1, defensiveReboundsPerGame: 4.5, stealsPerGame: 1.1, blocksPerGame: .5, position: "SF", team: "TST", ...changes });
const player = (position = "SF") => ({ id: "p1", name: "Fixture Player", firstName: "Fixture", lastName: "Player", position, primaryPosition: position, eligiblePositions: [position], team: "TST", active: true, draftEligible: true, imageUrl: "image.png", source: { provider: "fixture", externalId: "1" } });

test("normalized provider-neutral season stats reject malformed values", () => {
  assert.equal(normalizeSeasonStatRecord(stats()).threePointPercentage, .37);
  assert.throws(() => normalizeSeasonStatRecord(stats({ gamesPlayed: 5, gamesStarted: 6 })), /cannot exceed/);
  assert.throws(() => normalizeSeasonStatRecord(stats({ fieldGoalPercentage: 150 })), /between 0 and 1/);
});
test("Ratings V2 are deterministic, verified, integer, and bounded", () => {
  const first = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG" }) });
  assert.deepEqual(first, generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG" }) }));
  assert.equal(isValidRatingsV2(first), true);
  V2_RATING_KEYS.forEach((key) => assert.ok(Number.isInteger(first[key]) && first[key] >= 25 && first[key] <= 99));
});
test("skill fixtures differentiate shooting, creation, rebounding, rim protection, and defense", () => {
  const shooter = generatePlayerRatings({ player: player("SG"), seasonStats: stats({ position: "SG", pointsPerGame: 28, threePointPercentage: .43, threePointAttemptsPerGame: 10 }) });
  const inefficient = generatePlayerRatings({ player: player("SG"), seasonStats: stats({ position: "SG", pointsPerGame: 29, fieldGoalPercentage: .39, threePointPercentage: .29, threePointAttemptsPerGame: 9 }) });
  const creator = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG", assistsPerGame: 11, turnoversPerGame: 2.2 }) });
  const loose = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG", assistsPerGame: 9, turnoversPerGame: 5.5 }) });
  const center = generatePlayerRatings({ player: player("C"), seasonStats: stats({ position: "C", pointsPerGame: 18, assistsPerGame: 7.5, threePointAttemptsPerGame: 1, defensiveReboundsPerGame: 10, offensiveReboundsPerGame: 4, blocksPerGame: 2.8 }) });
  const stopper = generatePlayerRatings({ player: player("SF"), seasonStats: stats({ position: "SF", pointsPerGame: 9, stealsPerGame: 2.1, blocksPerGame: 1.2 }) });
  assert.ok(shooter.threePoint >= 88 && shooter.threePoint > inefficient.threePoint);
  assert.ok(creator.playmaking >= 88 && creator.turnoverControl > loose.turnoverControl);
  assert.ok(center.defensiveRebounding >= 88 && center.block >= 88 && center.playmaking >= 70);
  assert.ok(stopper.perimeterDefense > stopper.rimScoring && stopper.overall >= 60);
});
test("small samples regress toward baseline more strongly", () => {
  const established = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG", pointsPerGame: 34, assistsPerGame: 11 }) });
  const rookie = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG", gamesPlayed: 4, gamesStarted: 0, minutesPerGame: 8, pointsPerGame: 34, assistsPerGame: 11 }) });
  assert.ok(established.playmaking > rookie.playmaking && established.rimScoring > rookie.rimScoring);
});
test("position-aware overall values the same attributes differently", () => {
  const ratings = generatePlayerRatings({ player: player("PG"), seasonStats: stats({ position: "PG", assistsPerGame: 11, threePointPercentage: .42 }) });
  assert.notEqual(calculatePositionOverall(ratings, "PG"), calculatePositionOverall(ratings, "C"));
});
test("canonical compatibility distinguishes verified V2 from legacy baseline", () => {
  const ratings = generatePlayerRatings({ player: player(), seasonStats: stats() });
  const verified = { ...player(), overall: ratings.overall, ratingsVersion: 2, ratings };
  assert.equal(hasVerifiedRatingsV2(verified), true);
  assert.equal(normalizeCanonicalPlayerRatings({ id: "old", overall: 75, ratings: { overall: 75 } }).ratingsVersion, RATINGS_VERSION_V1);
  assert.equal(hasVerifiedRatingsV2({ ...verified, overall: 75 }), false);
});
test("Draft and Free Agency share one snapshot shape while legacy snapshots remain readable", () => {
  const ratings = generatePlayerRatings({ player: player(), seasonStats: stats() });
  const canonical = { ...player(), overall: ratings.overall, ratingsVersion: 2, ratings };
  const draft = buildLeaguePlayerSnapshot(canonical, 1000);
  const freeAgency = buildLeaguePlayerSnapshot(canonical, 1000);
  assert.deepEqual(draft, freeAgency);
  assert.equal(snapshotsShareGameplayShape(draft, freeAgency), true);
  assert.equal(normalizeLeaguePlayerSnapshot({ id: 10, name: "Old", overall: 75 }).snapshotVersion, 1);
  assert.deepEqual(canonical.ratings, ratings);
});
test("Free Agency appends the authoritative normalized snapshot without recalculating Contract V1", () => {
  const ratings = generatePlayerRatings({ player: player(), seasonStats: stats() });
  const canonical = { ...player(), overall: ratings.overall, ratingsVersion: 2, ratings };
  const snapshot = buildLeaguePlayerSnapshot(canonical, 1000);
  const signing = buildFreeAgentSigning({ league: { status: "offseason", season: 1, memberIds: ["owner"], offseason: { readyMemberIds: [] }, rosterConfig: { version: 2, rosterSize: 8 } }, team: { id: "owner", ownerUid: "owner", roster: [], lineup: {} }, player: canonical, rosterPlayer: snapshot, actorUid: "owner" });
  assert.deepEqual(signing.roster[0], snapshot);
  assert.equal(signing.contract.contractVersion, 1);
});
test("normalized snapshots remain compatible with unchanged Simulation V1", () => {
  const positions = ["PG", "SG", "SF", "PF", "C"];
  const roster = positions.map((position, index) => buildLeaguePlayerSnapshot({ ...player(position), id: `p${index}`, name: `Player ${index}`, stats: { points: 10, rebounds: 4, assists: 3 } }, 1000));
  const team = (uid) => ({ ownerUid: uid, name: uid, roster, lineup: Object.fromEntries(positions.map((position, index) => [position, roster[index].id])) });
  const game = simulateOfficialGame({ gameIdentity: { leagueId: "l", season: 1, scheduleVersion: 1, gameId: "g", homeUid: "h", awayUid: "a" }, homeTeam: team("h"), awayTeam: team("a"), rosterSize: 5 });
  assert.ok(game.result.homeScore !== game.result.awayScore);
  assert.equal(game.boxScore.version, 1);
});
test("missing league engine pins remain Simulation V1", () => {
  assert.deepEqual(resolveLeagueEngineVersions({}), { ratingsVersion: 1, simulationVersion: 1, eventSchemaVersion: 1, contractModelVersion: 1 });
  assert.equal(resolveLeagueEngineVersions({ engineVersions: { ratingsVersion: 2 } }).simulationVersion, SIMULATION_VERSION_V1);
});
test("coverage report identifies baseline, verified, malformed, and snapshot gaps", () => {
  const ratings = generatePlayerRatings({ player: player(), seasonStats: stats() });
  const verified = { ...player(), overall: ratings.overall, ratingsVersion: 2, ratings };
  const report = buildRatingsCoverageReport([verified, { ...player(), id: "legacy", overall: 75, ratingsVersion: 1 }, { ...player(), id: "bad", overall: 80, ratingsVersion: 2, ratings: {} }], [buildLeaguePlayerSnapshot(verified, 1), { id: "old", name: "Old" }]);
  assert.equal(report.verifiedV2Count, 1); assert.equal(report.v1BaselineCount, 2);
  assert.equal(report.malformedRatingsCount, 1); assert.equal(report.normalizedSnapshotCount, 1);
});
