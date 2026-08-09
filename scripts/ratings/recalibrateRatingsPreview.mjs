import { readFile, writeFile } from "node:fs/promises";
import { recalibrateRatingsPreviewPayload } from "../../functions/lib/recalibrateRatingsPreview.js";

const argument = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
const formatDistribution = (value) => Object.entries(value).map(([band, count]) => `${band}: ${count}`).join(", ");

async function main() {
  const input = argument("--input"); const output = argument("--output"); const formulaVersion = argument("--formula") || undefined;
  if (!input || !output) throw new Error("Provide --input <existing-preview.json> and --output <new-preview.json>.");
  console.log("Loading existing normalized Ratings preview...");
  const sourceText = await readFile(input, "utf8"); const payload = JSON.parse(sourceText);
  console.log("Running Ratings V2 elite calibration without provider access...");
  const result = recalibrateRatingsPreviewPayload(payload, { formulaVersion });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Normalized players recalibrated: ${result.manifest.recalibratedPlayerCount}; skipped without validated stats: ${result.manifest.skippedWithoutValidatedStats}`);
  console.log(`Formula: ${payload.preview.manifest.formulaVersion} -> ${result.preview.manifest.formulaVersion}`);
  console.log(`Average OVR: ${result.comparison.before.average} -> ${result.comparison.after.average}`);
  console.log(`Median OVR: ${result.comparison.before.median} -> ${result.comparison.after.median}`);
  console.log(`Maximum OVR: ${result.comparison.before.maximum} -> ${result.comparison.after.maximum}`);
  console.log(`Minimum OVR: ${result.comparison.before.minimum} -> ${result.comparison.after.minimum}`);
  console.log(`Standard deviation: ${result.comparison.before.standardDeviation} -> ${result.comparison.after.standardDeviation}`);
  console.log(`80+: ${result.comparison.before.ratings80Plus} -> ${result.comparison.after.ratings80Plus}; 85+: ${result.comparison.before.ratings85Plus} -> ${result.comparison.after.ratings85Plus}; 90+: ${result.comparison.before.ratings90Plus} -> ${result.comparison.after.ratings90Plus}; 95+: ${result.comparison.before.ratings95Plus} -> ${result.comparison.after.ratings95Plus}`);
  console.log(`Distribution: ${formatDistribution(result.comparison.after.distribution)}`);
  console.log(`Average delta: ${result.comparison.averageDelta}`);
  console.log(`Average absolute delta: ${result.comparison.averageAbsoluteDelta}; maximum absolute delta: ${result.comparison.maximumAbsoluteDelta}`);
  console.log(`Tier distribution: ${JSON.stringify(result.comparison.after.tierDistribution)}`);
  console.log(`Role distribution: ${JSON.stringify(result.comparison.after.roleDistribution)}`);
  console.log("Top 25 hierarchy diagnostic:");
  result.diagnostics.topOverall.forEach((player, index) => console.log(`${index + 1}. ${player.name} (${player.position}) raw ${player.rawOverall} -> confidence ${player.confidenceAdjustedOverall} -> ${player.finalOverall}; boost ${player.eliteBoost}; confidence ${player.confidence?.status}`));
  console.log(`Outlier queue: ${result.preview.manifest.calibrationOutliers.total}; critical: ${result.preview.manifest.calibrationOutliers.criticalCount}`);
  console.log(`Realism score: ${result.preview.manifest.calibrationRealism?.realismScore ?? "n/a"}; warnings: ${result.preview.manifest.calibrationRealism?.warnings?.length ?? 0}`);
  console.log(`Critical anomalies: ${result.preview.manifest.anomalySummary.criticalCount}`);
  console.log(`Local recalibrated preview: ${output}`);
  console.log("No provider request, Firebase write, or catalog publication occurred.");
}

try { await main(); } catch (error) { console.error(`Ratings recalibration failed: ${error.message}`); process.exitCode = 1; }
