import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { cleanLegacySeededCanonicalPlayer, getObsoleteLegacyFields, isLegacySeededCanonicalPlayer } from "../../functions/shared/legacyPlayerData.js";
import { findUndefinedPaths } from "../../functions/shared/nbaCatalog.js";

function initializeAdmin() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({ credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(), projectId: process.env.GCLOUD_PROJECT || "nba-fantasy-e3bf7" });
}

initializeAdmin();
const db = getFirestore();
const snapshot = await db.collection("playerCatalogs/current/players").get();
const documents = snapshot.docs.map((document) => ({ ref: document.ref, id: document.id, data: document.data() }));
const legacy = documents.filter(({ data }) => isLegacySeededCanonicalPlayer(data));
const obsoleteFieldCount = legacy.reduce((total, { data }) => total + getObsoleteLegacyFields(data).length, 0);
console.log(`Legacy-seeded canonical docs found: ${legacy.length}`);
console.log(`Obsolete manual fields found: ${obsoleteFieldCount}`);
console.log(`Clean canonical docs: ${documents.length - legacy.length}`);

const write = process.argv.includes("--write") && process.argv.includes("--confirm");
if (!write) {
  console.log("Audit only. No Firestore writes were made.");
  console.log("Use --write --confirm to clean only playerCatalogs/current/players.");
  process.exit(0);
}

const cleanedAt = new Date().toISOString();
// Normalize and validate every replacement before committing the first batch,
// preventing a malformed later document from causing a partial migration.
const replacements = legacy.map(({ ref, id, data }) => {
  const replacement = cleanLegacySeededCanonicalPlayer(data, cleanedAt);
  const undefinedPaths = findUndefinedPaths(replacement);
  if (undefinedPaths.length) {
    throw new Error(`Cannot migrate player ${id} (${data.name || "unknown"}): undefined at ${undefinedPaths.join(", ")}`);
  }
  return { ref, data: replacement };
});
console.log(`Preflight complete: ${replacements.length} replacement documents are Firestore-safe.`);
for (let index = 0; index < replacements.length; index += 400) {
  const chunk = replacements.slice(index, index + 400);
  const batch = db.batch();
  // Replace the canonical document so obsolete nested legacy fields cannot
  // survive through Firestore's recursive merge semantics. This script never
  // targets league-scoped snapshots or ownership documents.
  chunk.forEach(({ ref, data }) => batch.set(ref, cleanLegacySeededCanonicalPlayer(data, cleanedAt)));
  await batch.commit();
  console.log(`Cleaned batch ${Math.floor(index / 400) + 1}/${Math.ceil(legacy.length / 400)}.`);
}
console.log(`Legacy player-data cleanup complete: ${replacements.length} canonical documents updated.`);
