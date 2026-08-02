import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { combineMultiSeasonRatingsInput, loadOrFetchSeasonCache, normalizedSeasonArtifact } from "./multiSeasonRatingsInput.mjs";

const result = (season) => ({ manifest: { season }, players: [{ id: "p", externalPlayerId: "1" }], seasonStats: [{ externalPlayerId: "1", season }], preview: { players: [{ playerId: "p" }] } });
test("normalized season artifacts join canonical identity to season stats", () => { assert.equal(normalizedSeasonArtifact(result(2024), 2024).players[0].seasonStats.season, 2024); });
test("season cache prevents repeat provider calls", async () => { const directory = await mkdtemp(join(tmpdir(), "ratings-seasons-")); const cachePath = join(directory, "2024.json"); let calls = 0; const fetchSeason = async () => { calls += 1; return result(2024); }; await loadOrFetchSeasonCache({ cachePath, fetchSeason, season: 2024 }); await loadOrFetchSeasonCache({ cachePath, fetchSeason, season: 2024 }); assert.equal(calls, 1); assert.ok(JSON.parse(await readFile(cachePath, "utf8")).players.length); });
test("combined input preserves current artifact and never represents publication", () => { const currentPayload = { players: [{}], preview: { manifest: { season: 2025, publication: { enabled: false } } } }; const combined = combineMultiSeasonRatingsInput({ currentPayload, previousSeason: normalizedSeasonArtifact(result(2024), 2024), twoSeasonsAgo: normalizedSeasonArtifact(result(2023), 2023), createdAt: "fixed" }); assert.equal(combined.preview.manifest.publication.enabled, false); assert.equal(combined.multiSeason.previousSeason.season, "2024"); });
