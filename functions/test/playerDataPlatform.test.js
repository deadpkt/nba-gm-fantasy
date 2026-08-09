import test from "node:test";
import assert from "node:assert/strict";
import { createBalldontliePlayerProvider } from "../providers/balldontlie/playerProvider.js";
import { assertPlayerProvider } from "../providers/playerProvider.js";
import { normalizeCanonicalPlayer } from "../shared/canonicalPlayer.js";
import { buildPlayerDataCoverage } from "../shared/playerDataCoverage.js";
import { validateCanonicalPlayers } from "../shared/playerDataValidation.js";
import { PLAYER_IMPORT_MODE, runPlayerDataImport } from "../lib/playerDataImport.js";
import { fetchProviderCategories } from "../providers/balldontlie/categoryFetch.js";

const auth = { uid: "admin", token: { admin: true } };
const rawPlayer = (id, name, overrides = {}) => ({
  id,
  first_name: name.split(" ")[0],
  last_name: name.split(" ").slice(1).join(" "),
  position: "G",
  team: { id: 1, full_name: "Test Team", abbreviation: "TST" },
  ...overrides,
});

function fakeProvider(players = [rawPlayer(1, "Ada Guard")]) {
  return {
    id: "fixture",
    async fetchPlayers() { return players; },
    async fetchTeams() { return [{ id: "TST" }]; },
    async fetchSeasonStats() { return []; },
    normalizePlayer(row) {
      return {
        identity: { id: `fixture_${row.id}`, externalIds: [{ namespace: "fixture", value: String(row.id) }] },
        name: { full: `${row.first_name} ${row.last_name}` }, position: "PG", eligiblePositions: ["PG", "SG"],
        team: { abbreviation: "TST" }, headshot: { url: null },
        status: { active: true, draftEligible: true, retired: false }, ratings: null,
        metadata: { source: "fixture" },
      };
    },
    normalizeSeasonStats(row) { return row; },
  };
}

test("provider contract rejects incomplete adapters", () => {
  assert.throws(() => assertPlayerProvider({ id: "broken", fetchPlayers() {} }), /missing/i);
  assert.equal(assertPlayerProvider(fakeProvider()).id, "fixture");
});

test("BALLDONTLIE adapter contains provider fields and emits canonical input", async () => {
  const client = { request: async (path) => path === "/players/active"
    ? { data: [rawPlayer(7, "Current Guard")], meta: {} }
    : { data: [{ id: 1, abbreviation: "TST" }] } };
  const provider = createBalldontliePlayerProvider({ client, currentSeason: "2025-26" });
  const rows = await provider.fetchPlayers();
  const player = normalizeCanonicalPlayer(provider.normalizePlayer(rows[0]));
  assert.equal(player.identity.id, "bdl_7");
  assert.deepEqual(player.eligiblePositions, ["PG", "SG"]);
  assert.equal(player.status.active, true);
  assert.equal(player.metadata.source, "balldontlie");
  assert.equal(Object.hasOwn(player, "first_name"), false);
});

test("BALLDONTLIE GOAT category bundle maps only into normalized fields", () => {
  const provider = createBalldontliePlayerProvider({ client: { request: async () => ({ data: [] }) }, currentSeason: "2025-26" });
  const normalized = provider.normalizeSeasonStats({
    player: { id: 7, position: "G" }, base: { gp: 70, gs: 68, min: 34, pts: 25, ast: 8, turnover: 2.5, fg_pct: .49, fg3_pct: .4, fg3a: 9, ft_pct: .9, fta: 6, oreb: .5, dreb: 4, stl: 1.3, blk: .3 },
    advanced: { usage_percentage: .29, true_shooting_percentage: .64, effective_field_goal_percentage: .59, assist_percentage: .38, turnover_ratio: .1, offensive_rebound_percentage: .02, defensive_rebound_percentage: .12, assist_to_turnover: 3.2 },
    shooting: { rim_frequency: .2, rim_efficiency: .7, midrange_frequency: .12, midrange_efficiency: .45, three_point_frequency: .58, catch_and_shoot_efficiency: .44, pullup_efficiency: .39 },
    tracking: { drives: 12, drive_efficiency: 1.1, touches: 75, rim_contests: 1 }, hustle: { deflections: 3.2, contested_shots_3pt: 4 }, defense: { rim_opponent_efficiency: .58, perimeter_opponent_efficiency: .34 },
    primaryPosition: "PG", eligiblePositions: ["PG", "SG"], sourceCategoryCoverage: { base: true, advanced: true },
  });
  assert.equal(normalized.usageRate, .29); assert.equal(normalized.rimEfficiency, .7);
  assert.equal(normalized.passingMetrics.assistToTurnover, 3.2); assert.deepEqual(normalized.eligiblePositions, ["PG", "SG"]);
  assert.equal(Object.hasOwn(normalized, "usage_percentage"), false);
});

test("canonical normalization is provider-neutral and Firestore-safe", () => {
  const player = normalizeCanonicalPlayer({
    identity: { id: "p1", externalIds: [{ namespace: "fixture", value: 1 }] },
    name: { full: "Safe Player" }, position: "SF", eligiblePositions: ["SF", "PF"],
    team: { abbreviation: undefined }, metadata: { optional: undefined },
  });
  assert.equal(JSON.stringify(player).includes("undefined"), false);
  assert.equal(Object.hasOwn(player.metadata, "optional"), false);
});

test("validation reports every supported data-quality category", () => {
  const base = normalizeCanonicalPlayer({ identity: { id: "same", externalIds: [{ namespace: "x", value: "1" }] }, name: { full: "Same Name" }, position: "PG", eligiblePositions: ["PG"], status: { active: true }, ratings: { overall: 110, attributes: {} } });
  const duplicate = normalizeCanonicalPlayer({ identity: { id: "same", externalIds: [{ namespace: "x", value: "2" }] }, name: { full: "Same Name" }, position: "XX", eligiblePositions: ["XX"], status: { active: false, retired: true } });
  const result = validateCanonicalPlayers([base, duplicate]);
  assert.equal(result.valid, false);
  for (const code of ["duplicate-id", "duplicate-name", "invalid-position", "missing-team", "missing-image", "missing-stats", "inactive-player", "retired-player", "rating-out-of-bounds"]) assert.ok(result.counts[code] >= 1, code);
});

test("coverage report includes status, rating, image, duplicate, position, and rating distributions", () => {
  const players = [normalizeCanonicalPlayer({ identity: { id: "one" }, name: { full: "One" }, position: "C", eligiblePositions: ["C"], status: { active: true }, ratings: { verified: true, overall: 88, attributes: {} } })];
  const validation = validateCanonicalPlayers(players);
  const report = buildPlayerDataCoverage(players, validation);
  assert.equal(report.totalPlayers, 1);
  assert.equal(report.activePlayers, 1);
  assert.equal(report.playersWithVerifiedRatings, 1);
  assert.equal(report.positionDistribution.C, 1);
  assert.equal(report.ratingDistribution["85-89"], 1);
});

test("admin preview runs all stages and never invokes publisher", async () => {
  let writes = 0;
  const result = await runPlayerDataImport({ provider: fakeProvider(), auth, season: "2025-26", includeSeasonStats: false, publisher: async () => { writes += 1; } });
  assert.equal(result.published, false);
  assert.equal(result.report.coverage.totalPlayers, 1);
  assert.equal(writes, 0);
});

test("admin authorization protects preview and publish", async () => {
  await assert.rejects(() => runPlayerDataImport({ provider: fakeProvider(), auth: null }), /authentication/i);
  await assert.rejects(() => runPlayerDataImport({ provider: fakeProvider(), auth: { uid: "member", token: {} } }), /administrator/i);
});

test("publish requires confirmation, validation, and a trusted publisher", async () => {
  await assert.rejects(() => runPlayerDataImport({ provider: fakeProvider(), auth, mode: PLAYER_IMPORT_MODE.PUBLISH }), /confirmation/i);
  let payload;
  const result = await runPlayerDataImport({
    provider: fakeProvider(), auth, mode: PLAYER_IMPORT_MODE.PUBLISH, confirmed: true, includeSeasonStats: false,
    publisher: async (value) => { payload = value; },
  });
  assert.equal(result.published, true);
  assert.equal(payload.players[0].identity.id, "fixture_1");
});

test("partial provider category failures are explicit and never publishable", async () => {
  const result = await fetchProviderCategories({ base: async () => [1], advanced: async () => { throw new Error("rate limited"); }, tracking: async () => [] }, { required: ["base"] });
  assert.equal(result.status, "partial"); assert.equal(result.publishable, false);
  assert.deepEqual(result.coverage, { base: true, advanced: false, tracking: true });
  const failed = await fetchProviderCategories({ base: async () => { throw new Error("schema changed"); } }, { required: ["base"] });
  assert.equal(failed.status, "failed");
});
