import { assertPlayerProvider } from "../providers/playerProvider.js";
import { normalizeCanonicalPlayer } from "../shared/canonicalPlayer.js";
import { buildPlayerDataCoverage } from "../shared/playerDataCoverage.js";
import { validateCanonicalPlayers } from "../shared/playerDataValidation.js";

export const PLAYER_IMPORT_MODE = Object.freeze({ PREVIEW: "preview", PUBLISH: "publish" });

export function assertPlayerDataAdmin(auth) {
  if (!auth?.uid) throw new Error("Player-data administration requires authentication.");
  if (auth.token?.admin !== true) throw new Error("Player-data administrator access is required.");
}

export async function runPlayerDataImport({
  provider,
  auth,
  season,
  mode = PLAYER_IMPORT_MODE.PREVIEW,
  includeSeasonStats = true,
  generateRatings = (player) => player,
  publisher = null,
  confirmed = false,
} = {}) {
  assertPlayerDataAdmin(auth);
  assertPlayerProvider(provider);
  if (!Object.values(PLAYER_IMPORT_MODE).includes(mode)) throw new Error("Unknown player import mode.");

  const [providerPlayers, teams] = await Promise.all([provider.fetchPlayers({ season }), provider.fetchTeams({ season })]);
  const normalizedPlayers = providerPlayers.map((row) => normalizeCanonicalPlayer(provider.normalizePlayer(row, { season, teams })));
  const playerIds = normalizedPlayers.flatMap((player) => player.identity.externalIds.slice(0, 1).map((identity) => identity.value));
  const providerStats = includeSeasonStats ? await provider.fetchSeasonStats({ season, playerIds }) : [];
  const seasonStats = providerStats.map((row) => provider.normalizeSeasonStats(row, { season }));
  const statsByExternalId = new Map(seasonStats.map((row) => [String(row.externalPlayerId), row]));
  const players = normalizedPlayers.map((player) => normalizeCanonicalPlayer(generateRatings(player, statsByExternalId.get(player.identity.externalIds[0]?.value) || null)));
  const validation = validateCanonicalPlayers(players, seasonStats);
  const coverage = buildPlayerDataCoverage(players, validation);
  const report = { provider: provider.id, season, mode, teamsFetched: teams.length, validation, coverage };

  if (mode === PLAYER_IMPORT_MODE.PUBLISH) {
    if (!confirmed) throw new Error("Publishing requires explicit confirmation.");
    if (!validation.valid) throw new Error("Publishing blocked by player-data validation errors.");
    if (typeof publisher !== "function") throw new Error("A trusted catalog publisher is required.");
    await publisher({ players, seasonStats, report });
  }
  return { players, seasonStats, report, published: mode === PLAYER_IMPORT_MODE.PUBLISH };
}

