import assert from "node:assert/strict";
import test from "node:test";
import { cleanLegacySeededCanonicalPlayer, getObsoleteLegacyFields, isLegacySeededCanonicalPlayer } from "../shared/legacyPlayerData.js";
import { findUndefinedPaths } from "../shared/nbaCatalog.js";

const legacy = () => ({
  id: 201939, name: "Stephen Curry", firstName: "Stephen", lastName: "Curry",
  position: "PG", primaryPosition: "PG", eligiblePositions: ["PG", "SG"], sourcePosition: "G", team: "GSW",
  overall: 94, stats: { available: true, points: 24.5, rebounds: 4.4, assists: 6 }, ratings: { overall: 94 },
  gameData: { ratings: { overall: 94 }, customLegacy: true }, color: "#e7b22e", imageUrl: "headshot.png", nbaPlayerId: "201939",
  headshot: { nbaPlayerId: "201939", version: "headshots-v1" }, active: true, draftEligible: true, catalogOrder: 1,
  currentSeason: "2025-26", source: { provider: "balldontlie", externalId: 115, statsMode: "directory-fallback", syncedAt: "sync", verificationStrategy: "allowlist" },
  providerData: { height: "6-2", weight: "185", jerseyNumber: "30", college: "Davidson", country: "USA", draftYear: 2009, draftRound: 1, draftNumber: 7, nbaTeam: { id: 10, abbreviation: "GSW", name: "Warriors", fullName: "Golden State Warriors" } },
});

test("legacy cleanup preserves identity but removes implicit manual game overrides", () => {
  const before = legacy();
  const cleaned = cleanLegacySeededCanonicalPlayer(before, "cleaned");
  assert.equal(cleaned.id, 201939);
  assert.equal(cleaned.source.externalId, 115);
  assert.equal(cleaned.nbaPlayerId, "201939");
  assert.equal(cleaned.imageUrl, "headshot.png");
  assert.equal(cleaned.overall, 75);
  assert.equal(cleaned.stats.available, false);
  assert.equal(cleaned.ratings.version, "directory-baseline-v1");
  assert.equal(cleaned.color, "#526981");
  assert.equal(cleaned.gameData.customLegacy, undefined);
  assert.equal(cleaned.legacyIdentityPreserved, true);
});

test("cleanup is idempotent", () => {
  const cleaned = cleanLegacySeededCanonicalPlayer(legacy(), "first");
  assert.equal(isLegacySeededCanonicalPlayer(cleaned), false);
  assert.equal(cleanLegacySeededCanonicalPlayer(cleaned, "second"), cleaned);
});

test("migration replacement is Firestore-safe with incomplete optional metadata", () => {
  const incomplete = legacy();
  incomplete.providerData = {
    nbaTeam: { id: 10, name: "Warriors", abbreviation: "GSW" },
  };
  incomplete.catalogOrder = undefined;
  incomplete.headshot.version = undefined;
  const cleaned = cleanLegacySeededCanonicalPlayer(incomplete, "cleaned");
  assert.deepEqual(findUndefinedPaths(cleaned), []);
  assert.deepEqual(cleaned.providerData.nbaTeam, { id: 10, name: "Warriors", abbreviation: "GSW" });
  assert.equal("catalogOrder" in cleaned, false);
});

test("historical league snapshots are untouched because cleanup returns a new canonical value", () => {
  const historicalSnapshot = legacy();
  const historicalCopy = structuredClone(historicalSnapshot);
  cleanLegacySeededCanonicalPlayer(historicalSnapshot, "cleaned");
  assert.deepEqual(historicalSnapshot, historicalCopy);
});

test("legacy audit identifies only obsolete manual-owned fields", () => {
  assert.deepEqual(getObsoleteLegacyFields(legacy()), ["stats", "ratings", "gameData.ratings", "color", "overall"]);
});
