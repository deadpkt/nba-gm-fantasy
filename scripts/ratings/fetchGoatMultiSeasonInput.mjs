import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createBalldontlieClient } from "../../functions/providers/balldontlie/client.js";
import { fetchGoatRatingsPreview } from "../../functions/lib/goatRatingsImport.js";
import { createHeadshotIdentityLookup } from "../../functions/shared/nbaCatalog.js";
import { combineMultiSeasonRatingsInput, loadOrFetchSeasonCache } from "../lib/multiSeasonRatingsInput.mjs";
import { loadLocalEnv, requireLocalEnv } from "../lib/loadLocalEnv.mjs";

loadLocalEnv();
const require = createRequire(import.meta.url); const headshots = require("../../functions/data/nbaHeadshotIds.json");
const HISTORICAL_RATING_CATEGORIES = Object.freeze(["general_base", "general_advanced", "general_scoring", "shotdashboard_pullups", "shotdashboard_catch_and_shoot", "tracking_passing", "tracking_possessions"]);
const value = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };

async function main() {
  const season = Number(value("--season") || 2025); const input = value("--current-input") || `local-data/ratings/archive/goat-ratings-preview-${season}-v2.3.json`; const output = value("--output") || `local-data/ratings/current/goat-ratings-input-${season - 2}-${season}.json`;
  if (!Number.isInteger(season) || season < 2000) throw new Error("--season must be a four-digit ending season.");
  console.log(`Current season: ${season}`); console.log(`Current input: ${input}`); console.log(`Output: ${output}`); console.log("Mode: local fetch/cache only; publication disabled");
  const currentPayload = JSON.parse(await readFile(input, "utf8"));
  const apiKey = requireLocalEnv("BALLDONTLIE_API_KEY");
  const currentPlayers = currentPayload.players.map((entry) => entry?.player).filter(Boolean);
  if (!currentPlayers.length) throw new Error("Current preview contains no canonical players for historical identity matching.");
  console.log(`Canonical identities loaded from local preview: ${currentPlayers.length}`);
  const client = createBalldontlieClient({ apiKey, logger: console.log });
  console.log(`Historical categories: ${HISTORICAL_RATING_CATEGORIES.join(", ")}`);
  const fetchSeason = (targetSeason) => fetchGoatRatingsPreview({ client, season: targetSeason, currentPlayers, headshotLookup: createHeadshotIdentityLookup(headshots.entries), categoryIds: HISTORICAL_RATING_CATEGORIES, logger: console.log });
  const previous = await loadOrFetchSeasonCache({ cachePath: `local-data/ratings/cache/goat-ratings-cache-${season - 1}.json`, fetchSeason, season: season - 1, logger: console.log });
  const older = await loadOrFetchSeasonCache({ cachePath: `local-data/ratings/cache/goat-ratings-cache-${season - 2}.json`, fetchSeason, season: season - 2, logger: console.log });
  const combined = combineMultiSeasonRatingsInput({ currentPayload, previousSeason: previous.artifact, twoSeasonsAgo: older.artifact });
  await writeFile(output, `${JSON.stringify(combined, null, 2)}\n`, "utf8");
  console.log(`Previous season players: ${previous.artifact.players.length} (${previous.cacheHit ? "cache" : "provider"})`);
  console.log(`Two-seasons-ago players: ${older.artifact.players.length} (${older.cacheHit ? "cache" : "provider"})`);
  console.log(`Multi-season input complete: ${output}`); console.log("No Firebase write or catalog publication occurred.");
}

try { await main(); } catch (error) { console.error(`Multi-season input failed: ${error.message}`); process.exitCode = 1; }
