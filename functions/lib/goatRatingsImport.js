import { fetchAllCursorPages, ProviderCapabilityError } from "../providers/balldontlie/client.js";
import { createBalldontliePlayerProvider } from "../providers/balldontlie/playerProvider.js";
import { buildPlayerIdentityIndex, matchCanonicalPlayerIdentity } from "../shared/playerIdentity.js";
import { validateCanonicalPlayers } from "../shared/playerDataValidation.js";
import { generateRatingsPreview } from "./generateRatingsPreview.js";

export const GOAT_IMPORT_ADAPTER_VERSION = "balldontlie-goat-import-v1";
export const GOAT_PROVIDER_SCHEMA_VERSION = "nba-season-averages-v1";
export const GOAT_CATEGORIES = Object.freeze([
  { id: "general_base", category: "general", type: "base", required: true, target: "base" },
  { id: "general_advanced", category: "general", type: "advanced", required: false, target: "advanced" },
  { id: "general_scoring", category: "general", type: "scoring", required: false, target: "scoring" },
  { id: "shooting_5ft", category: "shooting", type: "5ft_range", required: false, target: "shooting" },
  { id: "shotdashboard_pullups", category: "shotdashboard", type: "pullups", required: false, target: "shooting" },
  { id: "shotdashboard_catch_and_shoot", category: "shotdashboard", type: "catch_and_shoot", required: false, target: "shooting" },
  { id: "tracking_passing", category: "tracking", type: "passing", required: false, target: "passing" },
  { id: "tracking_drives", category: "tracking", type: "drives", required: false, target: "tracking" },
  { id: "tracking_rebounding", category: "tracking", type: "rebounding", required: false, target: "tracking" },
  { id: "tracking_possessions", category: "tracking", type: "possessions", required: false, target: "tracking" },
  { id: "tracking_defense", category: "tracking", type: "defense", required: false, target: "tracking" },
  { id: "hustle", category: "hustle", type: null, required: false, target: "hustle" },
  { id: "defense_rim", category: "defense", type: "less_than_6ft", required: false, target: "defense" },
  { id: "defense_perimeter", category: "defense", type: "greater_than_15ft", required: false, target: "defense" },
  { id: "playtype_postup", category: "playtype", type: "postup", required: false, target: "playtype", subtype: "postup" },
  { id: "playtype_transition", category: "playtype", type: "transition", required: false, target: "playtype", subtype: "transition" },
]);

export function normalizeNbaSeason(value) {
  const text = String(value ?? "").trim();
  const match = /^(19|20)(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (!match) throw new Error("Season must be a year such as 2025 or a range such as 2025-26.");
  const start = Number(`${match[1]}${match[2]}`);
  if (start < 1996 || start > 2100 || (match[3] && Number(match[3]) !== (start + 1) % 100)) throw new Error("Season range is invalid or unsupported.");
  return { providerSeason: start, season: String(start), label: `${start}-${String((start + 1) % 100).padStart(2, "0")}` };
}

const playerIdOf = (row) => row?.player?.id ?? row?.player_id;
const seasonOf = (row) => Number(row?.season);
const mergeStats = (target, category, stats) => {
  target[category.target] ||= {};
  if (category.subtype) target[category.target][category.subtype] = { ...(target[category.target][category.subtype] || {}), ...stats };
  else Object.assign(target[category.target], stats);
};

export function joinGoatCategoryRecords({ activePlayers = [], categoryResults = {}, season }) {
  const activeIds = new Set(activePlayers.map((player) => String(player.id)));
  const joined = new Map(activePlayers.map((player) => [String(player.id), { player, season, sourceCategoryCoverage: {} }]));
  const findings = [];
  for (const category of GOAT_CATEGORIES) {
    const result = categoryResults[category.id];
    if (!result || result.status !== "complete") { for (const row of joined.values()) row.sourceCategoryCoverage[category.id] = false; continue; }
    const seen = new Set();
    for (const record of result.data) {
      const id = String(playerIdOf(record) ?? "");
      if (!id) { findings.push({ code: "missing-provider-player-id", category: category.id }); continue; }
      if (seen.has(id)) { findings.push({ code: "duplicate-category-record", category: category.id, playerId: id }); continue; }
      seen.add(id);
      if (seasonOf(record) !== Number(season)) { findings.push({ code: "season-mismatch", category: category.id, playerId: id, receivedSeason: record.season }); continue; }
      if (!activeIds.has(id)) { findings.push({ code: "category-player-not-active", category: category.id, playerId: id }); continue; }
      const target = joined.get(id); target.team ||= record.team || null; mergeStats(target, category, record.stats || {}); target.sourceCategoryCoverage[category.id] = true;
    }
    for (const [id, row] of joined) if (!seen.has(id)) { row.sourceCategoryCoverage[category.id] = false; findings.push({ code: "active-player-missing-category", category: category.id, playerId: id }); }
  }
  return { rows: [...joined.values()].toSorted((a, b) => a.player.id - b.player.id), findings };
}

async function fetchCategory(client, category, season, logger) {
  return fetchAllCursorPages((cursor) => client.request(`/nba/v1/season_averages/${category.category}`, { season, season_type: "regular", type: category.type, per_page: 100, cursor }), { logger, label: category.id, dedupe: false });
}

export async function fetchGoatRatingsPreview({ client, season: inputSeason, currentPlayers = [], headshotLookup = new Map(), categoryIds = null, maxPlayers = null, logger = () => {}, now = () => new Date() } = {}) {
  if (!client?.request) throw new Error("BALLDONTLIE client is required.");
  const normalizedSeason = normalizeNbaSeason(inputSeason);
  const started = now(); const startedMs = started.getTime();
  const selected = categoryIds?.length ? GOAT_CATEGORIES.filter((item) => categoryIds.includes(item.id)) : [...GOAT_CATEGORIES];
  if (!selected.some((item) => item.id === "general_base")) throw new Error("The required general_base category must be included.");
  logger("Fetching active players...");
  let activePlayers;
  try { activePlayers = await fetchAllCursorPages((cursor) => client.request("/players/active", { per_page: 100, cursor }), { logger, label: "active-player", dedupe: false }); }
  catch (error) { if (error instanceof ProviderCapabilityError) throw new Error("Your BALLDONTLIE plan does not appear to allow the active-player endpoint."); throw error; }
  const duplicateProviderIds = activePlayers.map((item) => String(item.id)).filter((id, index, ids) => ids.indexOf(id) !== index);
  activePlayers = [...new Map(activePlayers.map((item) => [String(item.id), item])).values()];
  activePlayers = activePlayers.toSorted((a, b) => a.id - b.id);
  if (Number.isInteger(maxPlayers) && maxPlayers > 0) activePlayers = activePlayers.slice(0, maxPlayers);
  logger(`Fetched ${activePlayers.length} active players.`);
  logger("Fetching NBA teams...");
  const teamsResponse = await client.request("/teams", { per_page: 100 });
  const teams = Array.isArray(teamsResponse?.data) ? teamsResponse.data : [];
  const teamIds = new Set(teams.map((team) => team.id));
  const categoryResults = {}; const errors = [];
  for (const category of selected) {
    logger(`Fetching ${category.id} season averages...`);
    try { const data = await fetchCategory(client, category, normalizedSeason.providerSeason, logger); categoryResults[category.id] = { status: "complete", data }; logger(`Fetched ${data.length} ${category.id} records.`); }
    catch (error) { const message = error instanceof ProviderCapabilityError ? `Your BALLDONTLIE plan does not appear to allow ${category.id}.` : error.message; categoryResults[category.id] = { status: "failed", data: [], error: message }; errors.push({ category: category.id, required: category.required, message }); if (category.required) break; }
  }
  const requiredFailed = selected.filter((category) => category.required && categoryResults[category.id]?.status !== "complete");
  const joined = joinGoatCategoryRecords({ activePlayers, categoryResults, season: normalizedSeason.providerSeason });
  const normalizationStarted = performance.now();
  const provider = createBalldontliePlayerProvider({ client, currentSeason: normalizedSeason.season, headshotLookup, logger });
  const identityIndex = buildPlayerIdentityIndex(currentPlayers); const identityReport = { matched: 0, new: 0, ambiguous: 0, unmatched: 0, manualReview: [], positionConflicts: [], unresolvedPositions: [] };
  const canonicalPlayers = activePlayers.map((raw) => {
    const normalized = provider.normalizePlayer(raw); normalized.status.active = true; normalized.status.draftEligible = true;
    const match = matchCanonicalPlayerIdentity(normalized, identityIndex); if (match.method === "ambiguous") identityReport.ambiguous += 1; else if (match.method === "unmatched") identityReport.unmatched += 1; else identityReport.matched += 1;
    if (match.reviewRequired) identityReport.manualReview.push({ providerId: raw.id, name: normalized.name.full, method: match.method, canonicalId: match.canonicalId });
    const existing = currentPlayers.find((player) => String(player.id) === String(match.canonicalId));
    if (!existing) identityReport.new += 1;
    else if ((existing.primaryPosition || existing.position) && (existing.primaryPosition || existing.position) !== normalized.position) identityReport.positionConflicts.push({ canonicalId: match.canonicalId, providerPosition: raw.position || null, resolvedPosition: normalized.position, currentPosition: existing.primaryPosition || existing.position });
    if (!String(raw.position || "").trim()) identityReport.unresolvedPositions.push({ providerId: raw.id, name: normalized.name.full, providerPosition: raw.position || null });
    return { ...normalized, id: match.canonicalId, identity: { ...normalized.identity, id: match.canonicalId }, externalPlayerId: String(raw.id), primaryPosition: normalized.position, active: true, draftEligible: true };
  });
  const playerByProviderId = new Map(canonicalPlayers.map((player) => [String(player.externalPlayerId), player]));
  const seasonStats = joined.rows.filter((row) => row.base).map((row) => provider.normalizeSeasonStats({ ...row, primaryPosition: playerByProviderId.get(String(row.player.id))?.primaryPosition, eligiblePositions: playerByProviderId.get(String(row.player.id))?.eligiblePositions }, { season: normalizedSeason.season }));
  const normalizationDurationMs = Math.round((performance.now() - normalizationStarted) * 100) / 100;
  const validation = validateCanonicalPlayers(canonicalPlayers, seasonStats);
  const optionalFailed = errors.filter((item) => !item.required);
  const unrequestedOptional = GOAT_CATEGORIES.filter((category) => !category.required && !selected.some((item) => item.id === category.id)).map((item) => item.id);
  const optionalMissingCategories = [...new Set([...optionalFailed.map((item) => item.category), ...unrequestedOptional])];
  const sourceCategoryCoverage = Object.fromEntries(GOAT_CATEGORIES.map((category) => [category.id, categoryResults[category.id]?.status === "complete"]));
  const completed = now(); const metrics = client.getMetrics?.() || { requestCount: null, retryCount: null };
  const fetchManifest = { provider: "balldontlie-goat", season: normalizedSeason.season, seasonLabel: normalizedSeason.label, startedAt: started.toISOString(), completedAt: completed.toISOString(), status: requiredFailed.length ? "failed" : optionalMissingCategories.length ? "partial" : "complete", requestedCategories: selected.map((item) => item.id), successfulCategories: selected.filter((item) => sourceCategoryCoverage[item.id]).map((item) => item.id), failedCategories: errors.map((item) => item.category), optionalMissingCategories, requestCount: metrics.requestCount, retryCount: metrics.retryCount, activePlayerCount: activePlayers.length, categoryRecordCounts: Object.fromEntries(selected.map((item) => [item.id, categoryResults[item.id]?.data?.length || 0])), providerSchemaVersion: GOAT_PROVIDER_SCHEMA_VERSION, adapterVersion: GOAT_IMPORT_ADAPTER_VERSION, partial: optionalMissingCategories.length > 0, errors, durationMs: completed.getTime() - startedMs, normalizationDurationMs, teamCount: teams.length, duplicateProviderIds: [...new Set(duplicateProviderIds)], unassignedPlayerIds: activePlayers.filter((player) => !player.team?.id).map((player) => player.id), invalidTeamAssociations: activePlayers.filter((player) => player.team?.id && !teamIds.has(player.team.id)).map((player) => player.id), joinFindingCounts: joined.findings.reduce((counts, finding) => ({ ...counts, [finding.code]: (counts[finding.code] || 0) + 1 }), {}), identityReport };
  if (requiredFailed.length) return { manifest: fetchManifest, players: canonicalPlayers, seasonStats, joinedFindings: joined.findings, validation, preview: null };
  const ratingStarted = performance.now();
  const preview = generateRatingsPreview({ players: canonicalPlayers, seasonStats, currentPlayers, season: normalizedSeason.season, sourceCategoryCoverage, createdAt: completed.toISOString() });
  preview.manifest.fetchManifest = fetchManifest; preview.manifest.performance.fetchDurationMs = fetchManifest.durationMs; preview.manifest.performance.normalizationDurationMs = normalizationDurationMs; preview.manifest.performance.ratingGenerationDurationMs = Math.round((performance.now() - ratingStarted) * 100) / 100;
  const joinReviewRequired = duplicateProviderIds.length > 0 || joined.findings.some((item) => ["duplicate-category-record", "season-mismatch"].includes(item.code));
  if (optionalMissingCategories.length || !validation.valid || joinReviewRequired) { preview.manifest.validationStatus = "review_required"; preview.manifest.publication.blockers = [...new Set([...preview.manifest.publication.blockers, optionalMissingCategories.length ? "partial-provider-categories" : null, !validation.valid ? "canonical-validation-failed" : null, joinReviewRequired ? "category-join-review" : null].filter(Boolean))]; }
  return { manifest: fetchManifest, players: canonicalPlayers, seasonStats, joinedFindings: joined.findings, validation, preview };
}
