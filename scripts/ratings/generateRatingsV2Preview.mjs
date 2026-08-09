import { readFile, writeFile } from "node:fs/promises";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateRatingsPreview, stageRatingsPreview } from "../../functions/lib/generateRatingsPreview.js";

const argument = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
const has = (name) => process.argv.includes(name);

async function main() {
  const inputPath = argument("--input");
  if (!inputPath) throw new Error("Provide a normalized preview input with --input <path>.");
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  if (!Array.isArray(input.players) || !Array.isArray(input.seasonStats) || !input.season) throw new Error("Input requires players, seasonStats, and season.");
  const startedAt = performance.now();
  const createdAt = new Date().toISOString();
  const initial = generateRatingsPreview({ ...input, createdAt });
  const preview = generateRatingsPreview({ ...input, createdAt, importId: initial.manifest.importId, generationDurationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
  console.log(`Ratings preview ${preview.manifest.importId}`);
  console.log(`Players: ${preview.manifest.playerCount}; verified: ${preview.manifest.verifiedCount}; provisional: ${preview.manifest.provisionalCount}; insufficient: ${preview.manifest.insufficientDataCount}`);
  console.log(`OVR average: ${preview.manifest.coverage.overallAverage}; 90+: ${preview.manifest.coverage.ratings90Plus}; 95+: ${preview.manifest.coverage.ratings95Plus}`);
  console.log(`Critical anomalies: ${preview.manifest.anomalySummary.criticalCount}; publication: disabled; licensing: ${preview.manifest.licensingCheckpoint.status}`);
  if (has("--stage")) {
    if (!has("--confirm")) throw new Error("Staging requires --stage --confirm.");
    const adminUid = argument("--admin-uid");
    if (!adminUid) throw new Error("Staging requires --admin-uid for custom-claim verification.");
    if (!getApps().length) initializeApp({ credential: applicationDefault() });
    const user = await getAuth().getUser(adminUid);
    if (user.customClaims?.admin !== true) throw new Error("The supplied Firebase user does not have the admin custom claim.");
    await stageRatingsPreview({ db: getFirestore(), auth: { uid: user.uid, token: user.customClaims }, preview });
    console.log("Admin staging complete. The live player catalog was not modified.");
    return;
  }
  const outputPath = argument("--output") || "ratings-v2-preview.json";
  await writeFile(outputPath, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  console.log(`Local preview written to ${outputPath}. No Firebase write was made.`);
}

main().catch((error) => { console.error(`Ratings preview failed: ${error.message}`); process.exitCode = 1; });
