import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  currentCatalogPlayers,
  currentCatalogSeedPlayers,
  currentPlayerCatalog,
} from "../src/data/players.js";

const writeRequested = process.argv.includes("--write");
const confirmed = process.argv.includes("--confirm");
const catalogPath = "playerCatalogs/current";

function fail(message) {
  throw new Error(message);
}

function validateSeed() {
  if (currentPlayerCatalog.playerCount !== currentCatalogPlayers.length) {
    fail("The catalog metadata player count does not match the source data.");
  }

  const playerIds = new Set();
  currentCatalogSeedPlayers.forEach((entry, catalogOrder) => {
    const { catalogOrder: savedOrder, ...player } = entry;
    if (
      !Number.isInteger(player.id) ||
      playerIds.has(player.id) ||
      savedOrder !== catalogOrder ||
      typeof player.name !== "string" ||
      typeof player.position !== "string" ||
      typeof player.team !== "string" ||
      !Number.isFinite(player.overall) ||
      typeof player.image !== "string" ||
      !Number.isFinite(player.stats?.points) ||
      !Number.isFinite(player.stats?.rebounds) ||
      !Number.isFinite(player.stats?.assists)
    ) {
      fail(`Invalid seed player at catalog order ${catalogOrder}.`);
    }
    playerIds.add(player.id);
  });
}

function initializeAdmin() {
  if (getApps().length) return getApps()[0];

  // GOOGLE_APPLICATION_CREDENTIALS may point to a Firebase service-account
  // JSON file. Application Default Credentials are also supported.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    credential: serviceAccount
      ? cert(JSON.parse(serviceAccount))
      : applicationDefault(),
  });
}

async function seedCatalog() {
  validateSeed();

  if (!writeRequested || !confirmed) {
    console.log(`Dry run: ${currentCatalogSeedPlayers.length} players are valid.`);
    console.log(`No documents were created. To write ${catalogPath}, run:`);
    console.log("npm run seed:player-catalog -- --write --confirm");
    return;
  }

  initializeAdmin();
  const db = getFirestore();
  const catalogRef = db.doc(catalogPath);
  const playerRefs = currentCatalogSeedPlayers.map((player) =>
    catalogRef.collection("players").doc(String(player.id)),
  );

  await db.runTransaction(async (transaction) => {
    const [catalogSnapshot, ...playerSnapshots] = await Promise.all([
      transaction.get(catalogRef),
      ...playerRefs.map((playerRef) => transaction.get(playerRef)),
    ]);

    if (catalogSnapshot.exists) {
      fail(`${catalogPath} already exists. This one-time seed will not overwrite it.`);
    }

    const existingPlayer = playerSnapshots.find((snapshot) => snapshot.exists);
    if (existingPlayer) {
      fail(
        `${existingPlayer.ref.path} already exists. This one-time seed will not overwrite it.`,
      );
    }

    transaction.create(catalogRef, {
      ...currentPlayerCatalog,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    currentCatalogSeedPlayers.forEach((player) => {
      transaction.create(catalogRef.collection("players").doc(String(player.id)), player);
    });
  });

  console.log(`Seeded ${catalogPath} and ${currentCatalogSeedPlayers.length} player documents.`);
}

seedCatalog().catch((error) => {
  console.error(`Player catalog seed aborted: ${error.message}`);
  process.exitCode = 1;
});
