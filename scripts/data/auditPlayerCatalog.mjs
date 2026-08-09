import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";
import { createHeadshotIdentityLookup } from "../../functions/shared/nbaCatalog.js";
import { auditCanonicalCatalog } from "../../functions/shared/catalogAudit.js";

const require = createRequire(import.meta.url);
const headshotSnapshot = require("../../functions/data/nbaHeadshotIds.json");

function initializeAdmin() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({ credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(), projectId: process.env.GCLOUD_PROJECT || "nba-fantasy-e3bf7" });
}

initializeAdmin();
const snapshot = await getFirestore().collection("playerCatalogs/current/players").get();
const players = snapshot.docs.map((document) => ({ documentId: document.id, ...document.data() }));
const headshotLookup = createHeadshotIdentityLookup(headshotSnapshot.entries);
const audit = auditCanonicalCatalog(players, headshotLookup);

console.log(`Total canonical docs: ${audit.total}`);
console.log(`Draft eligible count: ${audit.eligible}`);
console.log(`Duplicate normalized names: ${audit.duplicates.length}`);
audit.duplicates.forEach(({ name, ids }) => console.log(`  ${name}: ${ids.join(", ")}`));
console.log(`Legacy/manual-only eligible rows: ${audit.manualOnlyEligible.length}`);
audit.manualOnlyEligible.forEach((player) => console.log(`  ${player.documentId}: ${player.name}`));
console.log(`Headshot resolved: ${audit.headshotResolved}`);
console.log(`Placeholder fallback: ${audit.placeholder}`);
console.log(`Headshot mapping version: ${headshotSnapshot.version}`);
