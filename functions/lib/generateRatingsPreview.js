import { createHash } from "node:crypto";
import { detectRatingAnomalies } from "../shared/ratingAnomalies.js";
import { buildGeneratedRatingsCoverage } from "../shared/ratingCoverage.js";
import { generateRatingsV2Population, RATING_FORMULA_VERSION, RATING_FORMULA_VERSION_V2_4, RATINGS_SOURCE_V2 } from "../shared/playerRatingsV2.js";
import { buildRatingWarningsV24, buildV24WarningReport } from "../shared/playerRatingCalibrationV24.js";
import { buildRatingWarningsV241 } from "../shared/playerRatingCalibrationV241.js";

const median = (values) => values.length ? values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
const ratingBands = (rows, selector) => rows.reduce((distribution, row) => { const value = Number(selector(row)); if (!Number.isFinite(value)) return distribution; const band = `${Math.floor(value / 5) * 5}-${Math.min(99, Math.floor(value / 5) * 5 + 4)}`; distribution[band] = (distribution[band] || 0) + 1; return distribution; }, {});
const positionCounts = (rows, selector) => rows.reduce((distribution, row) => { const value = selector(row) || "UNKNOWN"; distribution[value] = (distribution[value] || 0) + 1; return distribution; }, {});

export function compareRatingsToCatalog(results = [], currentPlayers = []) {
  const current = new Map(currentPlayers.map((player) => [String(player.id), player]));
  const generated = new Set(results.map((result) => String(result.playerId)));
  const matched = results.filter((result) => current.has(String(result.playerId)));
  const deltas = matched.map((result) => ({ playerId: result.playerId, name: current.get(String(result.playerId))?.name || result.playerId, currentOverall: Number(current.get(String(result.playerId))?.overall) || 75, generatedOverall: result.overall, delta: result.overall - (Number(current.get(String(result.playerId))?.overall) || 75) }));
  const sortedDeltas = deltas.map((row) => row.delta).toSorted((a, b) => a - b);
  return {
    matchedPlayers: matched.length, newPlayers: results.length - matched.length,
    missingPlayers: currentPlayers.filter((player) => player.active === true && !generated.has(String(player.id))).length,
    removedOrInactivePlayers: currentPlayers.filter((player) => player.active !== true || !generated.has(String(player.id))).length,
    unchangedRatings: deltas.filter((row) => row.delta === 0).length, changedRatings: deltas.filter((row) => row.delta !== 0).length,
    averageOverallDelta: deltas.length ? Math.round(deltas.reduce((sum, row) => sum + row.delta, 0) / deltas.length * 100) / 100 : 0,
    medianOverallDelta: median(sortedDeltas), maxIncrease: deltas.toSorted((a, b) => b.delta - a.delta)[0] || null,
    maxDecrease: deltas.toSorted((a, b) => a.delta - b.delta)[0] || null,
    unusuallyLargeDeltas: deltas.filter((row) => Math.abs(row.delta) >= 12).toSorted((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    ratingDistributionChanges: { current: ratingBands(currentPlayers, (player) => player.overall), generated: ratingBands(results, (result) => result.overall) },
    positionDistributionChanges: { current: positionCounts(currentPlayers, (player) => player.primaryPosition || player.position), generated: positionCounts(results, (result) => result.normalizedInput?.primaryPosition) },
  };
}

export function generateRatingsPreview({ players = [], seasonStats = [], historicalSeasonStats = {}, currentPlayers = [], season, createdAt = new Date().toISOString(), importId = null, sourceCategoryCoverage = {}, generationDurationMs = null, formulaVersion = RATING_FORMULA_VERSION } = {}) {
  const generated = generateRatingsV2Population({ players, seasonStats, historicalSeasonStats, generatedAt: createdAt, formulaVersion });
  const anomalyReport = detectRatingAnomalies(generated.results);
  const coverage = buildGeneratedRatingsCoverage(generated.results, { expectedActivePlayers: players.filter((player) => player.active !== false && player.status?.active !== false).length, anomalies: anomalyReport });
  const comparisonToCurrentCatalog = compareRatingsToCatalog(generated.results, currentPlayers);
  const stableId = importId || `ratings_${String(season).replace(/[^0-9A-Za-z-]/g, "-")}_${createHash("sha256").update(`${formulaVersion}:${season}:${createdAt}`).digest("hex").slice(0, 12)}`;
  const previewBytes = Buffer.byteLength(JSON.stringify(generated.results), "utf8");
  const providerCategoriesComplete = !Object.values(sourceCategoryCoverage).includes(false);
  const realismApprovalEligible = !generated.realismReport || generated.realismReport.approvalEligible;
  const manifest = {
    importId: stableId, provider: RATINGS_SOURCE_V2, season, formulaVersion, createdAt,
    playerCount: generated.results.length, activePlayerCount: players.filter((player) => player.active !== false && player.status?.active !== false).length,
    verifiedCount: coverage.verifiedCount, provisionalCount: coverage.provisionalCount, insufficientDataCount: coverage.insufficientDataCount,
    validationStatus: coverage.publicationEligible && providerCategoriesComplete && realismApprovalEligible ? "eligible-after-licensing-review" : "review_required",
    ratingDistribution: coverage.ratingDistribution, coverage, sourceCategoryCoverage, comparisonToCurrentCatalog,
    anomalySummary: { criticalCount: anomalyReport.criticalCount + (generated.realismReport?.criticalIssues.length || 0), errorCount: anomalyReport.errorCount, warningCount: anomalyReport.warningCount + (generated.realismReport?.warnings.length || 0) },
    calibrationRealism: generated.realismReport || null,
    multiSeasonCoverage: { previousSeasonPlayers: historicalSeasonStats.previousSeason?.length || 0, twoSeasonsAgoPlayers: historicalSeasonStats.twoSeasonsAgo?.length || 0 },
    normalizationMetadata: generated.normalizationMetadata,
    licensingCheckpoint: { status: "required", approvedAt: null, requirements: ["fantasy game use", "persistent normalized-stat storage", "proprietary derived ratings", "historical retention", "identity display", "attribution"] },
    rawDataRetention: { policy: "normalized-only", rawProviderPayloadStored: false },
    performance: { generationDurationMs, previewBytes, estimatedMemoryBytes: previewBytes * 2, firestoreWriteEstimate: generated.results.length + 1 },
    publication: { enabled: false, target: null, blockers: ["licensing-checkpoint-required", "admin-calibration-review-required", ...(!providerCategoriesComplete ? ["partial-provider-categories"] : []), ...(!coverage.publicationEligible || !realismApprovalEligible ? ["coverage-or-anomaly-review"] : [])] },
  };
  const sourcePlayers = new Map(players.map((player) => [String(player.id ?? player.identity?.id), player]));
  const current = new Map(currentPlayers.map((player) => [String(player.id), player]));
  const previewPlayers = generated.results.map((result) => {
    const source = sourcePlayers.get(String(result.playerId)) || {};
    const existing = current.get(String(result.playerId));
    const name = source.name?.full || source.name || existing?.name || result.playerId;
    return {
      ...result, name,
      primaryPosition: source.primaryPosition || result.normalizedInput.primaryPosition,
      eligiblePositions: source.eligiblePositions || result.normalizedInput.eligiblePositions,
      currentOverall: Number(existing?.overall) || null,
      overallDelta: Number.isFinite(Number(existing?.overall)) ? result.overall - Number(existing.overall) : null,
      anomalies: anomalyReport.anomalies.filter((item) => item.playerId === result.playerId),
      outliers: (result.outliers || []).map((item) => ({ ...item, name })),
    };
  });
  if ([RATING_FORMULA_VERSION_V2_4, RATING_FORMULA_VERSION].includes(formulaVersion)) {
    previewPlayers.forEach((player) => { player.outliers = formulaVersion === RATING_FORMULA_VERSION ? buildRatingWarningsV241(player, previewPlayers) : buildRatingWarningsV24(player, previewPlayers); });
    const realism = formulaVersion === RATING_FORMULA_VERSION ? { criticalIssues: [], warnings: previewPlayers.flatMap((player) => player.outliers || []), groups: [], approvalEligible: true } : buildV24WarningReport(previewPlayers);
    realism.positionAverages = generated.realismReport?.positionAverages || {};
    realism.realismScore = Math.max(0, Math.round((100 - realism.criticalIssues.length * 4 - realism.warnings.length * .2) * 10) / 10);
    manifest.calibrationRealism = realism;
    manifest.anomalySummary.criticalCount = anomalyReport.criticalCount + realism.criticalIssues.length;
    manifest.anomalySummary.warningCount = anomalyReport.warningCount + realism.warnings.length;
    manifest.validationStatus = coverage.publicationEligible && providerCategoriesComplete && realism.approvalEligible ? "eligible-after-licensing-review" : "review_required";
    if (!realism.approvalEligible && !manifest.publication.blockers.includes("coverage-or-anomaly-review")) manifest.publication.blockers.push("coverage-or-anomaly-review");
  }
  return { manifest, players: previewPlayers, anomalies: anomalyReport.anomalies };
}

export const RATINGS_PREVIEW_STAGE_BATCH_SIZE = 100;
export const RATINGS_PREVIEW_COMMIT_TIMEOUT_MS = 90_000;
const RATINGS_PREVIEW_STAGING_VERSION = 1;
const hashValue = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const snapshotData = (snapshot) => snapshot?.exists ? snapshot.data() : null;
const safeFailure = (error) => ({
  code: String(error?.code || "staging-write-failed").slice(0, 80),
  message: String(error?.message || "Ratings preview staging failed.").replace(/[\r\n]+/g, " ").slice(0, 300),
});

export function withRatingsPreviewTimeout(promise, timeoutMs = RATINGS_PREVIEW_COMMIT_TIMEOUT_MS, operation = "Firestore operation") {
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(Object.assign(new Error(`${operation} timed out after ${timeoutMs}ms.`), { code: "deadline-exceeded" })), timeoutMs);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timeout));
}

async function writePlayerBatch({ db, importId, players, timeoutMs, batchNumber, batchCount }) {
  const documents = players.map((player) => ({
    ...player,
    importId,
    formulaVersion: player.ratingFormulaVersion,
    provider: player.ratingsSource,
  }));
  const batch = db.batch();
  documents.forEach((player) => batch.set(db.doc(`playerDataImports/${importId}/players/${player.playerId}`), player));
  try { await withRatingsPreviewTimeout(batch.commit(), timeoutMs, `Batch ${batchNumber}/${batchCount}`); }
  catch (error) { throw Object.assign(new Error(`Batch ${batchNumber}/${batchCount} failed: ${String(error?.code || error?.message || "unknown").toUpperCase()}`), { code: error?.code || "staging-batch-failed", cause: error }); }
}

export async function stageRatingsPreview({ db, auth, preview, batchSize = RATINGS_PREVIEW_STAGE_BATCH_SIZE, commitTimeoutMs = RATINGS_PREVIEW_COMMIT_TIMEOUT_MS, logger = () => {} } = {}) {
  if (!auth?.uid || auth.token?.admin !== true) throw new Error("Ratings preview staging requires an admin custom claim.");
  if (!db?.doc || !db?.batch || !db?.runTransaction) throw new Error("Firestore Admin SDK is required for preview staging.");
  if (preview?.manifest?.publication?.enabled !== false || preview?.manifest?.licensingCheckpoint?.status !== "required") throw new Error("Only non-publishable licensing-blocked previews may be staged.");
  const importId = preview.manifest.importId;
  const ids = preview?.players?.map((player) => String(player?.playerId || "")) || [];
  if (!importId || !ids.length || ids.length > 700 || ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error("Ratings preview identity, unique players, or bounded player count is invalid.");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > RATINGS_PREVIEW_STAGE_BATCH_SIZE) throw new Error(`Ratings preview staging batch size must be from 1 to ${RATINGS_PREVIEW_STAGE_BATCH_SIZE}.`);
  const importRef = db.doc(`playerDataImports/${importId}`);
  const importHash = hashValue({ provider: preview.manifest.provider, season: preview.manifest.season, formulaVersion: preview.manifest.formulaVersion, players: preview.players });
  if (!Number.isInteger(commitTimeoutMs) || commitTimeoutMs < 1) throw new Error("Ratings preview commit timeout must be a positive integer.");
  const existing = snapshotData(await withRatingsPreviewTimeout(importRef.get(), commitTimeoutMs, "Import manifest lookup"));
  const existingHash = existing?.importHash;
  if (existing) logger(`Existing import ${importId} detected with status ${existing.status || "legacy-partial"}.`);
  if (existingHash && existingHash !== importHash) throw new Error("A staged import with this ID has a different source hash.");
  if (existing && !existingHash && ["provider", "season", "formulaVersion"].some((field) => String(existing[field] || "") !== String(preview.manifest[field] || ""))) throw new Error("A legacy partial import with this ID has different provider, season, or formula metadata.");
  if (existing?.status === "ready" && existing.importHash === importHash && existing.stagedPlayerCount === ids.length) { logger(`Import ${importId} is already ready with ${ids.length} staged players.`); return { importId, playerCount: ids.length, published: false, status: "ready", idempotent: true }; }
  if (existing?.status === "failed") logger(`Retrying failed import ${importId}; completed matching batches will be reused.`);
  else if (existing) logger(`Resuming import ${importId}; completed matching batches will be reused.`);

  const startedAt = new Date().toISOString();
  logger("Preparing staging manifest...");
  await withRatingsPreviewTimeout(importRef.set({
    ...preview.manifest,
    status: "staging",
    expectedPlayerCount: ids.length,
    writtenPlayerCount: 0,
    stagedPlayerCount: 0,
    startedAt,
    completedAt: null,
    stagingVersion: RATINGS_PREVIEW_STAGING_VERSION,
    stagedBy: auth.uid,
    adminUid: auth.uid,
    importHash,
    stagingFailure: null,
  }, { merge: false }), commitTimeoutMs, "Staging manifest write");
  logger(`Preparing import ${importId}...`);

  const groups = [];
  for (let index = 0; index < preview.players.length; index += batchSize) {
    const players = preview.players.slice(index, index + batchSize);
    groups.push({ index: groups.length, players, checksum: hashValue(players.map((player) => [player.playerId, player.overall, player.ratingFormulaVersion])) });
  }
  let writtenPlayerCount = 0;
  try {
    for (const group of groups) {
      const ledgerRef = db.doc(`playerDataImports/${importId}/stagingBatches/${String(group.index).padStart(4, "0")}`);
      const ledger = snapshotData(await withRatingsPreviewTimeout(ledgerRef.get(), commitTimeoutMs, `Batch ${group.index + 1}/${groups.length} ledger lookup`));
      if (ledger?.status === "complete" && ledger.checksum === group.checksum && ledger.playerCount === group.players.length) {
        writtenPlayerCount += group.players.length;
        logger(`Batch ${group.index + 1}/${groups.length} already complete (${group.players.length} players).`);
        continue;
      }
      logger(`Writing batch ${group.index + 1}/${groups.length} (${group.players.length} players)...`);
      await writePlayerBatch({ db, importId, players: group.players, timeoutMs: commitTimeoutMs, batchNumber: group.index + 1, batchCount: groups.length });
      await withRatingsPreviewTimeout(ledgerRef.set({ index: group.index, playerCount: group.players.length, status: "complete", committedAt: new Date().toISOString(), checksum: group.checksum, importHash }, { merge: false }), commitTimeoutMs, `Batch ${group.index + 1}/${groups.length} ledger write`);
      writtenPlayerCount += group.players.length;
      await withRatingsPreviewTimeout(importRef.set({ status: "staging", writtenPlayerCount, updatedAt: new Date().toISOString() }, { merge: true }), commitTimeoutMs, `Batch ${group.index + 1}/${groups.length} progress write`);
      logger(`Completed batch ${group.index + 1}/${groups.length} (${writtenPlayerCount}/${ids.length} players).`);
    }
    logger("Finalizing manifest...");
    await withRatingsPreviewTimeout(db.runTransaction(async (transaction) => {
      const manifestSnapshot = await transaction.get(importRef);
      const manifest = snapshotData(manifestSnapshot);
      if (!manifest || manifest.status !== "staging" || manifest.importHash !== importHash || manifest.expectedPlayerCount !== ids.length) throw new Error("Staging manifest changed before finalization.");
      const ledgerSnapshots = await Promise.all(groups.map((group) => transaction.get(db.doc(`playerDataImports/${importId}/stagingBatches/${String(group.index).padStart(4, "0")}`))));
      const verifiedCount = ledgerSnapshots.reduce((count, snapshot, index) => {
        const ledger = snapshotData(snapshot); const group = groups[index];
        if (!ledger || ledger.status !== "complete" || ledger.checksum !== group.checksum || ledger.importHash !== importHash || ledger.playerCount !== group.players.length) throw new Error(`Staging batch ${index + 1} is incomplete or mismatched.`);
        return count + ledger.playerCount;
      }, 0);
      if (verifiedCount !== ids.length) throw new Error(`Staged player count mismatch: expected ${ids.length}, found ${verifiedCount}.`);
      transaction.set(importRef, { status: "ready", writtenPlayerCount: verifiedCount, stagedPlayerCount: verifiedCount, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stagingFailure: null }, { merge: true });
    }), commitTimeoutMs, "Import finalization transaction");
    return { importId, playerCount: ids.length, published: false, status: "ready", batchCount: groups.length };
  } catch (error) {
    await withRatingsPreviewTimeout(importRef.set({ status: "failed", writtenPlayerCount, updatedAt: new Date().toISOString(), stagingFailure: safeFailure(error) }, { merge: true }), commitTimeoutMs, "Failure status write").catch(() => {});
    error.importId = importId; error.writtenPlayerCount = writtenPlayerCount; error.expectedPlayerCount = ids.length;
    throw error;
  }
}
