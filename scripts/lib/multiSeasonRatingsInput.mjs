import { readFile, writeFile } from "node:fs/promises";

export const MULTI_SEASON_INPUT_VERSION = "ratings-multi-season-input-v1";

export function normalizedSeasonArtifact(result, season) {
  if (!result?.preview?.players?.length || !Array.isArray(result.players) || !Array.isArray(result.seasonStats)) throw new Error(`Season ${season} did not produce a valid normalized Ratings artifact.`);
  const stats = new Map(result.seasonStats.map((item) => [String(item.externalPlayerId), item]));
  return { season: String(season), manifest: result.manifest, players: result.players.map((player) => ({ player, seasonStats: stats.get(String(player.externalPlayerId)) || null })).filter((entry) => entry.seasonStats) };
}

export function combineMultiSeasonRatingsInput({ currentPayload, previousSeason, twoSeasonsAgo, createdAt = new Date().toISOString() }) {
  if (!Array.isArray(currentPayload?.players) || !currentPayload?.preview?.manifest) throw new Error("Current Ratings preview artifact is invalid.");
  if (!previousSeason?.players?.length || !twoSeasonsAgo?.players?.length) throw new Error("Two normalized historical seasons are required for a three-season input.");
  return {
    ...currentPayload,
    multiSeason: { schemaVersion: MULTI_SEASON_INPUT_VERSION, createdAt, currentSeason: String(currentPayload.preview.manifest.season), previousSeason, twoSeasonsAgo },
  };
}

export async function loadOrFetchSeasonCache({ cachePath, fetchSeason, season, logger = () => {} }) {
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    if (String(cached?.season) !== String(season) || !cached?.players?.length) throw new Error("cache schema mismatch");
    logger(`Using cached normalized season ${season}: ${cachePath}`);
    return { artifact: cached, cacheHit: true };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.message !== "cache schema mismatch") throw new Error(`Season ${season} cache is invalid: ${error.message}`);
  }
  logger(`Fetching and normalizing season ${season}...`);
  const artifact = normalizedSeasonArtifact(await fetchSeason(season), season);
  await writeFile(cachePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  logger(`Cached normalized season ${season}: ${cachePath}`);
  return { artifact, cacheHit: false };
}
