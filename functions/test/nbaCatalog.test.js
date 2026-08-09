import assert from "node:assert/strict";
import test from "node:test";
import { createBalldontlieClient, fetchAllCursorPages } from "../providers/balldontlie/client.js";
import {
  buildCanonicalPlayer, calculateGameRatings, getAvailableLeaguePlayers,
  assertPlausibleCurrentPlayerCount, mergeProviderCatalog, normalizePosition,
  createHeadshotIdentityLookup, isCanonicalDraftCandidate, paginateCatalog,
  resolveHeadshotEnrichment, selectCanonicalProviderIdentities, selectCurrentPlayerCandidates,
  findUndefinedPaths,
} from "../shared/nbaCatalog.js";

const provider = (id, name, position = "G") => ({ id, first_name: name.split(" ")[0], last_name: name.split(" ").slice(1).join(" "), position, draft_year: 2020, team: { id: 10, name: "Warriors", full_name: "Golden State Warriors", abbreviation: "GSW" } });

test("cursor pagination consumes every page and removes duplicates", async () => {
  const pages = new Map([[undefined, { data: [{ id: 1 }, { id: 2 }], meta: { next_cursor: 2 } }], [2, { data: [{ id: 2 }, { id: 3 }], meta: {} }]]);
  assert.deepEqual((await fetchAllCursorPages((cursor) => pages.get(cursor))).map((row) => row.id), [1, 2, 3]);
});

test("cursor pagination rejects a repeated cursor", async () => {
  await assert.rejects(
    fetchAllCursorPages(async () => ({ data: [{ id: 1 }], meta: { next_cursor: 2 } })),
    /duplicate next_cursor 2/,
  );
});

test("cursor pagination stops safely on an empty page", async () => {
  let calls = 0;
  const rows = await fetchAllCursorPages(async () => {
    calls += 1;
    return { data: [], meta: { next_cursor: 99 } };
  });
  assert.deepEqual(rows, []);
  assert.equal(calls, 1);
});

test("cursor pagination enforces a maximum-page guard", async () => {
  await assert.rejects(
    fetchAllCursorPages(async (cursor) => ({ data: [{ id: cursor ?? 0 }], meta: { next_cursor: (cursor ?? 0) + 1 } }), { maxPages: 2 }),
    /2-page safety limit/,
  );
});

test("provider requests time out instead of hanging indefinitely", async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
  const client = createBalldontlieClient({ apiKey: "hidden", fetchImpl, maxRetries: 0, minimumIntervalMs: 0, requestTimeoutMs: 10 });
  await assert.rejects(client.request("/players", { per_page: 1 }), /timed out after 10ms/);
});

test("generic provider positions normalize deterministically", () => {
  const expected = { G: ["PG", "SG"], F: ["SF", "PF"], C: ["C"], "G-F": ["SG", "SF"], "F-G": ["SG", "SF"], "F-C": ["PF", "C"], "C-F": ["PF", "C"] };
  Object.entries(expected).forEach(([source, positions]) => assert.deepEqual(normalizePosition(source, "new").eligiblePositions, positions));
  assert.equal(normalizePosition("F", "201939").primaryPosition, "PG");
});

test("legacy name mapping preserves stable IDs without preserving manual game data", () => {
  const existing = { id: 201939, name: "Stephen Curry", overall: 94, position: "PG", team: "GSW", image: "legacy.png", color: "gold", stats: { points: 25, rebounds: 4, assists: 6 }, gameData: { custom: true } };
  const merged = mergeProviderCatalog({ providerPlayers: [provider(115, "Stephen Curry")], existingPlayers: [existing], activeIds: new Set([115]), syncedAt: "now" }).players[0];
  assert.equal(merged.id, 201939);
  assert.equal(merged.image, "legacy.png");
  assert.equal(merged.stats.available, false);
  assert.equal(merged.ratings.source, "game-baseline");
  assert.equal(merged.ratings.version, "directory-baseline-v1");
  assert.equal(merged.gameData.custom, undefined);
  assert.equal(merged.color, "#526981");
  const contract = { playerId: 201939, salary: 20_000_000 };
  assert.equal(contract.playerId, merged.id);
});

test("directory fallback ratings are deterministic and bounded", () => {
  const first = buildCanonicalPlayer({ providerPlayer: provider(900, "New Player"), active: true, syncedAt: "now" });
  const second = buildCanonicalPlayer({ providerPlayer: provider(900, "New Player"), active: true, syncedAt: "now" });
  assert.deepEqual(first.ratings, second.ratings);
  assert.ok(first.overall >= 60 && first.overall <= 99);
  assert.equal(first.stats.available, false);
  const enriched = calculateGameRatings({ available: true, points: 25, assists: 7, rebounds: 5, fgPct: .5, threePct: .38, steals: 1, blocks: .5, minutes: 34 }, "PG");
  Object.values(enriched).filter(Number.isFinite).forEach((value) => assert.ok(value >= 60 && value <= 99));
});

test("canonical player omits missing team fields and contains no undefined values", () => {
  const incomplete = provider(901, "Incomplete Player");
  incomplete.team = { id: 10, abbreviation: "GSW" };
  incomplete.height = undefined;
  incomplete.college = undefined;
  const canonical = buildCanonicalPlayer({ providerPlayer: incomplete, active: true, syncedAt: "now" });
  assert.deepEqual(canonical.providerData.nbaTeam, { id: 10, abbreviation: "GSW" });
  assert.equal(canonical.providerData.height, null);
  assert.equal(canonical.providerData.college, null);
  assert.deepEqual(findUndefinedPaths(canonical), []);
});

test("canonical player accepts stored camelCase team names during migration", () => {
  const migrated = provider(902, "Migrated Player");
  migrated.team = { id: 10, name: "Warriors", fullName: "Golden State Warriors" };
  const canonical = buildCanonicalPlayer({ providerPlayer: migrated, active: true, syncedAt: "now" });
  assert.equal(canonical.providerData.nbaTeam.fullName, "Golden State Warriors");
  assert.deepEqual(findUndefinedPaths(canonical), []);
});

test("provider sync retains missing players as inactive and preserves unique identities", () => {
  const existing = [{ id: "legacy", name: "Historical Player", active: true, source: { externalId: 2 } }];
  const merged = mergeProviderCatalog({ providerPlayers: [provider(1, "Active Player")], existingPlayers: existing, activeIds: new Set([1]), syncedAt: "now" });
  assert.equal(merged.players.length, 1);
  assert.equal(merged.inactive[0].active, false);
  assert.equal(merged.inactive[0].draftEligible, false);
  assert.notEqual(merged.players[0].id, merged.inactive[0].id);
  const retry = mergeProviderCatalog({ providerPlayers: [provider(1, "Active Player")], existingPlayers: [...merged.players, ...merged.inactive], activeIds: new Set([1]), syncedAt: "now" });
  assert.equal(retry.players[0].id, merged.players[0].id);
  assert.equal(retry.inactive[0].id, merged.inactive[0].id);
});

test("large pools support availability, eligible-position search, and pagination", () => {
  const players = Array.from({ length: 240 }, (_, index) => ({ id: index, name: `Player ${index}`, team: "T", position: "PG", eligiblePositions: ["PG", "SG"], overall: 75, active: true, draftEligible: true, source: { provider: "balldontlie", externalId: index } }));
  const available = getAvailableLeaguePlayers(players, new Set(["1", "2"]));
  assert.equal(available.length, 238);
  const page = paginateCatalog(available, { search: "Player", position: "SG", limit: 48 });
  assert.equal(page.items.length, 48);
  assert.equal(page.total, 238);
  assert.equal(page.nextOffset, 48);
});

test("season allowlist includes current players and excludes historical team records", () => {
  const directory = [
    provider(1, "Current Player"),
    provider(2, "Historical Player"),
    provider(3, "Michael Jordan"),
  ];
  const candidates = selectCurrentPlayerCandidates(directory, ["Current Player"]);
  assert.deepEqual(candidates.map((player) => player.id), [1]);
});

test("stale catalog players remain reference-compatible but cannot reappear in Draft", () => {
  const stale = { id: "bdl_2", name: "Retired Star", fullName: "Retired Star", active: true, draftEligible: true, source: { externalId: 2 } };
  const merged = mergeProviderCatalog({
    providerPlayers: [provider(1, "Current Player")],
    existingPlayers: [stale],
    activeIds: new Set([1]),
    syncedAt: "now",
    currentSeason: "2025-26",
    verificationStrategy: "test-allowlist",
  });
  assert.equal(merged.inactive[0].id, "bdl_2");
  assert.equal(merged.inactive[0].draftEligible, false);
  assert.deepEqual(getAvailableLeaguePlayers([...merged.players, ...merged.inactive], new Set()).map((player) => player.name), ["Current Player"]);
});

test("existing roster IDs remain stable when an eligible provider player is refreshed", () => {
  const existing = { id: "league-stable-player", name: "Current Player", fullName: "Current Player", source: { externalId: 1 } };
  const merged = mergeProviderCatalog({ providerPlayers: [provider(1, "Current Player")], existingPlayers: [existing], activeIds: new Set([1]), syncedAt: "now" });
  assert.equal(merged.players[0].id, "league-stable-player");
  assert.equal(merged.players[0].draftEligible, true);
});

test("implausible current-player counts cannot be published", () => {
  assert.throws(() => assertPlausibleCurrentPlayerCount(349), /implausible/);
  assert.throws(() => assertPlausibleCurrentPlayerCount(701), /implausible/);
  assert.doesNotThrow(() => assertPlausibleCurrentPlayerCount(540));
});

test("manual-only eligible documents are excluded from canonical Draft candidates", () => {
  assert.equal(isCanonicalDraftCandidate({ active: true, draftEligible: true, source: { provider: "manual" } }), false);
  assert.equal(isCanonicalDraftCandidate({ active: true, draftEligible: true, source: { provider: "balldontlie", externalId: 115 } }), true);
});

test("verified NBA identity resolves a headshot without using BALLDONTLIE ID", () => {
  const lookup = createHeadshotIdentityLookup([{ name: "Stephen Curry", nbaPlayerId: "201939" }]);
  assert.deepEqual(resolveHeadshotEnrichment("Stephen Curry", lookup), {
    nbaPlayerId: "201939",
    imageUrl: "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png",
  });
  assert.equal(resolveHeadshotEnrichment("Unknown Player", lookup), null);
});

test("duplicate provider identities collapse to the verified team or richer record", () => {
  const lookup = createHeadshotIdentityLookup([{ name: "Duplicate Player", nbaPlayerId: "999", team: "CUR" }]);
  const duplicate = [
    { ...provider(50, "Duplicate Player"), team: { id: 1, abbreviation: "OLD" }, draft_year: null },
    { ...provider(75, "Duplicate Player"), team: { id: 2, abbreviation: "CUR" }, draft_year: 2022 },
  ];
  assert.deepEqual(selectCanonicalProviderIdentities(duplicate, lookup).map((player) => player.id), [75]);
});

test("provider refresh preserves trusted headshot enrichment fields", () => {
  const existing = { id: "stable", name: "Current Player", nbaPlayerId: "999", imageUrl: "https://cdn.nba.com/headshots/nba/latest/1040x760/999.png", headshot: { nbaPlayerId: "999", version: "trusted-v1" }, source: { externalId: 1 } };
  const merged = mergeProviderCatalog({ providerPlayers: [provider(1, "Current Player")], existingPlayers: [existing], activeIds: new Set([1]), syncedAt: "now" }).players[0];
  assert.equal(merged.nbaPlayerId, "999");
  assert.equal(merged.imageUrl, existing.imageUrl);
  assert.equal(merged.headshot.version, "trusted-v1");
});
