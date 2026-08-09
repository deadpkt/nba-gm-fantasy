import { isValidRatingsV2, RATING_FORMULA_VERSION } from "./playerRatingsV2.js";
import { trustedReviewBlockers } from "./ratingsReview.js";

export const CATALOG_PUBLICATION_CONFIRMATION_PREFIX = "PUBLISH";
export const CATALOG_ROLLBACK_CONFIRMATION_PREFIX = "ROLLBACK";
export const CATALOG_VERSION_PATTERN = /^\d{4}\.\d+$/;

const positionOf = (player) => player.primaryPosition || player.position || "UNKNOWN";
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : 0;
const counts = (rows, select) => rows.reduce((result, row) => { const key = select(row) || "UNKNOWN"; result[key] = (result[key] || 0) + 1; return result; }, {});

export function catalogPublicationBlockers({ importId, manifest, previewPlayers = [], basePlayers = [], version, confirmation, licensingApproval } = {}) {
  const blockers = [];
  const coverage = manifest?.coverage || {};
  if (manifest?.status !== "ready") blockers.push({ code: "preview-not-ready", message: "Ratings preview staging must complete before publication." });
  blockers.push(...trustedReviewBlockers(importId, manifest));
  if (manifest?.formulaVersion && manifest.formulaVersion !== RATING_FORMULA_VERSION) blockers.push({ code: "unsupported-formula-version", message: `Only the current internal ratings formula (${RATING_FORMULA_VERSION}) can be published.` });
  if (!CATALOG_VERSION_PATTERN.test(String(version || ""))) blockers.push({ code: "invalid-version", message: "Use a version such as 2026.1." });
  if (confirmation !== `${CATALOG_PUBLICATION_CONFIRMATION_PREFIX} ${version}`) blockers.push({ code: "approval-confirmation-required", message: `Type PUBLISH ${version} to confirm.` });
  if (!String(licensingApproval?.basis || "").trim()) blockers.push({ code: "publication-license-basis-required", message: "Document the approved licensing basis for this publication." });
  if (!manifest || !previewPlayers.length) blockers.push({ code: "preview-empty", message: "The approved preview has no players." });
  if (manifest?.validationStatus !== "eligible-after-licensing-review" || coverage.publicationEligible !== true) blockers.push({ code: "validation-failed", message: "Preview validation is not publication eligible." });
  if ((manifest?.anomalySummary?.criticalCount || coverage.criticalAnomalyCount || 0) > 0) blockers.push({ code: "critical-anomalies", message: "Critical anomalies must be resolved." });
  if ((coverage.duplicateIdentityCount || 0) > 0) blockers.push({ code: "duplicate-identities", message: "Duplicate canonical identities are present." });
  if ((coverage.duplicateProviderIdCount || 0) > 0) blockers.push({ code: "duplicate-provider-ids", message: "Duplicate provider identities are present." });
  if ((coverage.missingPositionCount || 0) > 0) blockers.push({ code: "missing-positions", message: "Every rated player needs a valid primary position." });
  if ((coverage.malformedRatingCount || 0) > 0 || previewPlayers.some((player) => !isValidRatingsV2(player.ratings) || player.overall !== player.ratings.overall)) blockers.push({ code: "invalid-ratings", message: "Every preview rating must satisfy Ratings V2 bounds." });
  const ids = previewPlayers.map((player) => String(player.playerId));
  if (new Set(ids).size !== ids.length) blockers.push({ code: "duplicate-preview-player", message: "Preview player IDs must be unique." });
  const baseIds = new Set(basePlayers.map((player) => String(player.id)));
  const missingBase = ids.filter((id) => !baseIds.has(id));
  if (missingBase.length) blockers.push({ code: "canonical-base-missing", message: `${missingBase.length} preview players lack canonical catalog identity data.` });
  return blockers;
}

export function buildPublishedCatalogPlayers(basePlayers = [], previewPlayers = []) {
  const ratings = new Map(previewPlayers.map((player) => [String(player.playerId), player]));
  return basePlayers.map((base) => {
    const preview = ratings.get(String(base.id));
    if (!preview) return { ...base };
    return {
      ...base,
      primaryPosition: preview.primaryPosition || preview.normalizedInput?.primaryPosition || base.primaryPosition,
      eligiblePositions: preview.eligiblePositions || preview.normalizedInput?.eligiblePositions || base.eligiblePositions,
      overall: preview.overall,
      ratingsVersion: preview.ratingsVersion,
      ratings: preview.ratings,
      ratingsSource: preview.ratingsSource,
      ratingsSeason: preview.ratingsSeason,
      ratingsGeneratedAt: preview.ratingsGeneratedAt,
      ratingsStatus: preview.ratingsStatus,
      ratingsConfidence: preview.ratingsConfidence,
      ratingFormulaVersion: preview.ratingFormulaVersion || RATING_FORMULA_VERSION,
      gameData: { ...(base.gameData || {}), ratings: preview.ratings, ratingsVersion: preview.ratingsVersion },
    };
  });
}

export function compareCatalogVersions(previous = [], next = []) {
  const before = new Map(previous.map((player) => [String(player.id), player]));
  const after = new Map(next.map((player) => [String(player.id), player]));
  const matched = [...after.keys()].filter((id) => before.has(id));
  const deltas = matched.map((id) => ({ playerId: id, name: after.get(id).name || before.get(id).name || id, from: Number(before.get(id).overall) || 0, to: Number(after.get(id).overall) || 0, delta: (Number(after.get(id).overall) || 0) - (Number(before.get(id).overall) || 0) }));
  return {
    matchedPlayers: matched.length,
    newPlayers: [...after.keys()].filter((id) => !before.has(id)),
    removedPlayers: [...before.keys()].filter((id) => !after.has(id)),
    averageOverallDelta: average(deltas.map((row) => row.delta)),
    largestIncreases: deltas.toSorted((a, b) => b.delta - a.delta).slice(0, 10),
    largestDecreases: deltas.toSorted((a, b) => a.delta - b.delta).slice(0, 10),
    ratingDistribution: { previous: counts(previous, (player) => Math.floor((Number(player.overall) || 0) / 5) * 5), next: counts(next, (player) => Math.floor((Number(player.overall) || 0) / 5) * 5) },
    positionDistribution: { previous: counts(previous, positionOf), next: counts(next, positionOf) },
    statusChanges: matched.filter((id) => before.get(id).ratingsStatus !== after.get(id).ratingsStatus).map((id) => ({ playerId: id, from: before.get(id).ratingsStatus || "legacy", to: after.get(id).ratingsStatus || "legacy" })),
  };
}

export function validateRollback({ targetVersion, currentVersion, confirmation } = {}) {
  const blockers = [];
  if (targetVersion !== "legacy-current" && !CATALOG_VERSION_PATTERN.test(String(targetVersion || ""))) blockers.push({ code: "invalid-target", message: "A published catalog version is required." });
  if (targetVersion === currentVersion) blockers.push({ code: "already-current", message: "That catalog is already active." });
  if (confirmation !== `${CATALOG_ROLLBACK_CONFIRMATION_PREFIX} ${targetVersion}`) blockers.push({ code: "rollback-confirmation-required", message: `Type ROLLBACK ${targetVersion} to confirm.` });
  return blockers;
}
