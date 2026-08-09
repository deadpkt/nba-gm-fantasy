import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const writeRequested = process.argv.includes("--write");
const confirmed = process.argv.includes("--confirm");
const catalogPath = "playerCatalogs/current";
const requiredMetadata = {
  ratingVersion: "manual-v1",
  season: "2025-26",
};

function initializeAdmin() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    credential: serviceAccount
      ? cert(JSON.parse(serviceAccount))
      : applicationDefault(),
  });
}

function missingMetadata(data) {
  const missing = {};
  Object.entries(requiredMetadata).forEach(([field, value]) => {
    if (!Object.hasOwn(data, field)) missing[field] = value;
  });
  if (!Object.hasOwn(data, "updatedAt")) {
    missing.updatedAt = FieldValue.serverTimestamp();
  }
  return missing;
}

async function migrateCatalogMetadata() {
  initializeAdmin();
  const db = getFirestore();
  const catalogRef = db.doc(catalogPath);
  const snapshot = await catalogRef.get();

  if (!snapshot.exists) {
    throw new Error(`${catalogPath} does not exist; nothing was changed.`);
  }

  const plannedUpdate = missingMetadata(snapshot.data());
  const fields = Object.keys(plannedUpdate);
  if (!fields.length) {
    console.log(`${catalogPath} already has all required metadata. No changes needed.`);
    return;
  }

  console.log(`Metadata missing from ${catalogPath}: ${fields.join(", ")}`);
  if (!writeRequested || !confirmed) {
    console.log("Dry run only. No documents were changed.");
    console.log("To apply only these missing fields, run:");
    console.log("npm run migrate:player-catalog-metadata -- --write --confirm");
    return;
  }

  // This transaction reads and updates only playerCatalogs/current. It does
  // not query, read, or write its players subcollection, league teams, users,
  // rosters, matches, or any other Firestore document.
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(catalogRef);
    if (!current.exists) {
      throw new Error(`${catalogPath} no longer exists; migration aborted.`);
    }

    const update = missingMetadata(current.data());
    if (Object.keys(update).length) transaction.update(catalogRef, update);
  });

  console.log(`Updated only missing metadata fields on ${catalogPath}: ${fields.join(", ")}`);
}

migrateCatalogMetadata().catch((error) => {
  console.error(`Player catalog metadata migration aborted: ${error.message}`);
  process.exitCode = 1;
});
