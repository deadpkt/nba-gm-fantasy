import test from "node:test";
import assert from "node:assert/strict";
import { buildPublishedCatalogPlayers, catalogPublicationBlockers, compareCatalogVersions, validateRollback } from "../shared/catalogPublication.js";

const ratings = Object.fromEntries(["overall", "rimScoring", "midRange", "threePoint", "freeThrow", "playmaking", "ballHandling", "turnoverControl", "perimeterDefense", "interiorDefense", "steal", "block", "offensiveRebounding", "defensiveRebounding", "athleticism", "stamina", "consistency"].map((key) => [key, 80]));
ratings.version = 2; ratings.source = "verified-season-stats:balldontlie";
const base = [{ id: "p1", name: "One", position: "PG", primaryPosition: "PG", eligiblePositions: ["PG"], overall: 70, active: true, draftEligible: true, stats: { points: 1, rebounds: 1, assists: 1 } }];
const preview = [{ playerId: "p1", overall: 80, ratingsVersion: 2, ratings, ratingsStatus: "verified", ratingFormulaVersion: "ratings-v2.0.0" }];
const manifest = { status: "ready", validationStatus: "eligible-after-licensing-review", coverage: { publicationEligible: true, criticalAnomalyCount: 0, duplicateIdentityCount: 0, duplicateProviderIdCount: 0, missingPositionCount: 0, malformedRatingCount: 0 }, anomalySummary: { criticalCount: 0 } };
const approved = { manifest, previewPlayers: preview, basePlayers: base, version: "2026.1", confirmation: "PUBLISH 2026.1", licensingApproval: { status: "approved", basis: "Recorded commercial review" } };

test("eligible approved preview has no publication blockers", () => assert.deepEqual(catalogPublicationBlockers(approved), []));
test("partial staged imports cannot be published", () => assert.ok(catalogPublicationBlockers({ ...approved, manifest: { ...manifest, status: "staging" } }).some((item) => item.code === "preview-not-ready")));
test("unreviewed elite calibration cannot be published", () => assert.ok(catalogPublicationBlockers({ ...approved, manifest: { ...manifest, calibrationReview: { status: "required" } } }).some((item) => item.code === "calibration-review-required")));
test("unsupported ratings formula versions cannot be published", () => {
  const blockers = catalogPublicationBlockers({ ...approved, manifest: { ...manifest, formulaVersion: "retired-ratings-model" } });
  assert.ok(blockers.some((item) => item.code === "unsupported-formula-version"));
});
test("licensing checkpoint blocks publication", () => assert.ok(catalogPublicationBlockers({ ...approved, licensingApproval: null }).some((item) => item.code === "licensing-checkpoint-required")));
test("coverage failure blocks publication", () => assert.ok(catalogPublicationBlockers({ ...approved, manifest: { ...manifest, coverage: { ...manifest.coverage, publicationEligible: false } } }).some((item) => item.code === "validation-failed")));
test("duplicate identities block publication", () => assert.ok(catalogPublicationBlockers({ ...approved, previewPlayers: [...preview, preview[0]] }).some((item) => item.code === "duplicate-preview-player")));
test("invalid ratings block publication", () => assert.ok(catalogPublicationBlockers({ ...approved, previewPlayers: [{ ...preview[0], overall: 100 }] }).some((item) => item.code === "invalid-ratings")));
test("canonical publication preserves identity and applies ratings", () => { const [player] = buildPublishedCatalogPlayers(base, preview); assert.equal(player.name, "One"); assert.equal(player.overall, 80); assert.equal(player.gameData.ratingsVersion, 2); });
test("comparison reports players and deltas", () => { const comparison = compareCatalogVersions(base, [...buildPublishedCatalogPlayers(base, preview), { ...base[0], id: "p2" }]); assert.equal(comparison.matchedPlayers, 1); assert.deepEqual(comparison.newPlayers, ["p2"]); assert.equal(comparison.averageOverallDelta, 10); });
test("rollback requires exact confirmation", () => assert.ok(validateRollback({ targetVersion: "2026.1", currentVersion: "2026.2", confirmation: "yes" }).length));
test("rollback accepts an older immutable version", () => assert.deepEqual(validateRollback({ targetVersion: "2026.1", currentVersion: "2026.2", confirmation: "ROLLBACK 2026.1" }), []));
test("first publication can roll back to the frozen legacy baseline", () => assert.deepEqual(validateRollback({ targetVersion: "legacy-current", currentVersion: "2026.1", confirmation: "ROLLBACK legacy-current" }), []));
test("published base input remains unmodified", () => { buildPublishedCatalogPlayers(base, preview); assert.equal(base[0].overall, 70); });
