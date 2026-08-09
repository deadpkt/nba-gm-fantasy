import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createBalldontlieClient } from "../../functions/providers/balldontlie/client.js";
import { fetchGoatRatingsPreview, GOAT_CATEGORIES } from "../../functions/lib/goatRatingsImport.js";
import { createHeadshotIdentityLookup } from "../../functions/shared/nbaCatalog.js";
import { loadLocalEnv, requireLocalEnv } from "../lib/loadLocalEnv.mjs";
import {
  applicationDefaultCredentialsMessage,
  createAdminStagingContext,
  isApplicationDefaultCredentialsError,
  parseRatingsCliOptions,
  reconcilePublicationBlockers,
  stageValidatedPreview,
  stagingSuccessMessages,
  validateStageOptions,
} from "../lib/ratingsPreviewStaging.mjs";

loadLocalEnv();

const require = createRequire(import.meta.url); const headshots = require("../../functions/data/nbaHeadshotIds.json");
async function loadCurrentCatalog(db) { const pointer = await db.doc("playerCatalogs/current").get(); const version = pointer.data()?.catalogVersion; const path = !version || version === "legacy-current" ? "playerCatalogs/current/players" : `playerCatalogs/${version}/players`; return (await db.collection(path).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() })); }
const distribution = (value) => Object.entries(value || {}).map(([band, count]) => `${band}: ${count}`).join(", ") || "none";

async function main() {
  const options = parseRatingsCliOptions(process.argv.slice(2));
  validateStageOptions(options);
  const apiKey = requireLocalEnv("BALLDONTLIE_API_KEY");
  const season = options.season; if (!season) throw new Error("Provide --season 2025 or --season 2025-26.");
  const outputPath = options.output || `local-data/ratings/current/goat-ratings-preview-${season}.json`;
  console.log(`Mode: ${options.stage ? "stage" : "local preview"}`);
  console.log(`Season: ${season}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Admin UID supplied: ${options.admin_uid ? "yes" : "no"}`);
  const category = options.category; const categoryIds = category ? [...new Set(["general_base", ...category.split(",").map((item) => item.trim()).filter(Boolean)])] : null;
  if (categoryIds?.some((id) => !GOAT_CATEGORIES.some((item) => item.id === id))) throw new Error("--category contains an unsupported category ID.");
  const rawMax = options.max_players; const maxPlayers = rawMax ? Number(rawMax) : null; if (rawMax && (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 700)) throw new Error("--max-players must be an integer from 1 to 700.");
  let stagingContext = null;
  if (options.stage) stagingContext = await createAdminStagingContext({ adminUid: options.admin_uid, logger: console.log });
  try { if (!getApps().length) initializeApp({ credential: applicationDefault() }); }
  catch (error) { if (isApplicationDefaultCredentialsError(error)) throw new Error(applicationDefaultCredentialsMessage(), { cause: error }); throw error; }
  const db = stagingContext?.db || getFirestore();
  const currentPlayers = await loadCurrentCatalog(db); const client = createBalldontlieClient({ apiKey, logger: console.log });
  const result = await fetchGoatRatingsPreview({ client, season, currentPlayers, headshotLookup: createHeadshotIdentityLookup(headshots.entries), categoryIds, maxPlayers, logger: console.log });
  result.preview = reconcilePublicationBlockers(result.preview);
  const normalized = { manifest: result.manifest, players: result.players.map((player) => ({ player, seasonStats: result.seasonStats.find((stats) => String(stats.externalPlayerId) === String(player.externalPlayerId)) || null })), validation: result.validation, joinedFindings: result.joinedFindings, preview: result.preview };
  const output = `${JSON.stringify(normalized, null, 2)}\n`; await writeFile(outputPath, output, "utf8");
  const preview = result.preview?.manifest;
  console.log("\nGOAT Ratings Preview Summary"); console.log(`Active players fetched: ${result.manifest.activePlayerCount}`); console.log(`Normalized players: ${result.seasonStats.length}`); console.log(`Canonical matched: ${result.manifest.identityReport.matched}; new: ${result.manifest.identityReport.new}; ambiguous: ${result.manifest.identityReport.ambiguous}; unmatched: ${result.manifest.identityReport.unmatched}`); console.log(`Required category coverage: ${result.manifest.failedCategories.filter((id) => GOAT_CATEGORIES.find((item) => item.id === id)?.required).length ? "FAILED" : "complete"}`); console.log(`Optional missing: ${result.manifest.optionalMissingCategories.join(", ") || "none"}`); console.log(`Requests: ${result.manifest.requestCount}; retries: ${result.manifest.retryCount}; fetch duration: ${result.manifest.durationMs}ms`);
  if (preview) { console.log(`Verified/provisional/insufficient: ${preview.verifiedCount}/${preview.provisionalCount}/${preview.insufficientDataCount}`); console.log(`Critical anomalies: ${preview.anomalySummary.criticalCount}; OVR average: ${preview.coverage.overallAverage}`); console.log(`Rating distribution: ${distribution(preview.ratingDistribution)}`); console.log(`Large deltas: ${preview.comparisonToCurrentCatalog.unusuallyLargeDeltas.length}`); console.log(`Publishable: ${preview.validationStatus === "eligible-after-licensing-review" && !preview.publication.blockers.some((item) => item !== "publication-not-implemented" && item !== "licensing-checkpoint-required") ? "after licensing approval" : "no"}`); console.log(`Publication blockers: ${preview.publication.blockers.join(", ")}`); }
  console.log(`Local output: ${outputPath} (${Buffer.byteLength(output)} bytes).`);
  if (options.stage) {
    if (!result.preview || result.manifest.status === "failed") throw new Error("A failed required-category import cannot be staged.");
    const staged = await stageValidatedPreview({ preview: result.preview, adminUid: options.admin_uid, contextFactory: async () => stagingContext, logger: console.log });
    stagingSuccessMessages(staged.importId).forEach((message) => console.log(message));
  } else console.log("Local-only preview complete. No Firebase write was made.");
}
main().catch((error) => { if (error.importId) { console.error(`Staging failed after ${error.writtenPlayerCount || 0}/${error.expectedPlayerCount || 0} players.`); console.error("Import remains non-ready."); console.error(`Import ID: ${error.importId}`); } console.error(`GOAT ratings preview failed: ${error.message}`); process.exitCode = 1; });
