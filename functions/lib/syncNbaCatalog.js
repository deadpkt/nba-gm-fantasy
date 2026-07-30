import { createRequire } from "node:module";
import { assertPlausibleCurrentPlayerCount, createHeadshotIdentityLookup, mergeProviderCatalog, selectCanonicalProviderIdentities, selectCurrentPlayerCandidates, CATALOG_SYNC_VERSION } from "../shared/nbaCatalog.js";
import { createBalldontlieClient, loadProviderDirectory } from "./balldontlie.js";

const require = createRequire(import.meta.url);
const currentPlayerSnapshot = require("../data/currentPlayers-2025-26.json");
const headshotIdentitySnapshot = require("../data/nbaHeadshotIds.json");

async function commitChunks(db, operations, size = 400, logger = () => {}) {
  const batchCount = Math.ceil(operations.length / size);
  for (let index = 0; index < operations.length; index += size) {
    logger(`Writing batch ${Math.floor(index / size) + 1}/${batchCount}...`);
    const batch = db.batch();
    operations.slice(index, index + size).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

export async function syncNbaCatalog({ db, apiKey, now = new Date().toISOString(), logger = () => {} }) {
  const catalogRef = db.doc("playerCatalogs/current");
  const syncRef = db.doc("playerCatalogs/syncStatus");
  logger("Recording catalog sync start in Firestore...");
  await syncRef.set({ status: "running", provider: "balldontlie", startedAt: now, syncVersion: CATALOG_SYNC_VERSION }, { merge: true });
  try {
    logger("Connecting to BALLDONTLIE...");
    const client = createBalldontlieClient({ apiKey, logger });
    const [directory, existingSnapshot] = await Promise.all([
      loadProviderDirectory(client, { logger }), catalogRef.collection("players").get(),
    ]);
    const totalProviderPlayers = directory.totalDirectoryPlayers ?? directory.players.length;
    const rawCandidates = directory.activeMode === "provider-active"
      ? directory.players
      : selectCurrentPlayerCandidates(directory.players, currentPlayerSnapshot.names);
    const headshotLookup = createHeadshotIdentityLookup(headshotIdentitySnapshot.entries);
    const candidates = directory.activeMode === "provider-active"
      ? rawCandidates
      : selectCanonicalProviderIdentities(rawCandidates, headshotLookup);
    const filteringStrategy = directory.activeMode === "provider-active"
      ? "provider-active"
      : currentPlayerSnapshot.strategy;
    assertPlausibleCurrentPlayerCount(candidates.length);
    logger(`Provider fetch complete: ${totalProviderPlayers} directory players.`);
    logger(`Total provider directory players: ${totalProviderPlayers}`);
    logger(`Current-player candidates: ${candidates.length}`);
    logger(`Duplicate provider identities excluded: ${rawCandidates.length - candidates.length}`);
    logger(`Draft eligible: ${candidates.length}`);
    logger(`Historical/inactive excluded: ${totalProviderPlayers - candidates.length}`);
    logger(`Filtering strategy: ${filteringStrategy}`);
    const capabilities = {
      players: true,
      activePlayers: directory.activeMode === "provider-active",
      enrichedStats: false,
    };
    const existingPlayers = existingSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    const activeIds = new Set(candidates.map((player) => player.id));
    const merged = mergeProviderCatalog({
      providerPlayers: candidates,
      existingPlayers,
      activeIds,
      syncedAt: now,
      currentSeason: currentPlayerSnapshot.season,
      verificationStrategy: filteringStrategy,
      headshotLookup,
      headshotVersion: headshotIdentitySnapshot.version,
    });
    const headshotResolvedCount = merged.players.filter((player) => player.nbaPlayerId && player.imageUrl !== "/player-placeholder.svg").length;
    logger(`Headshot resolved: ${headshotResolvedCount}`);
    logger(`Placeholder fallback: ${merged.players.length - headshotResolvedCount}`);
    const operations = [
      ...merged.players.map((player, order) => ({ ref: catalogRef.collection("players").doc(String(player.id)), data: { ...player, catalogOrder: order } })),
      ...merged.inactive.map((player) => ({ ref: catalogRef.collection("players").doc(String(player.id)), data: { active: false, draftEligible: false, source: player.source || null } })),
    ];
    logger(`Preparing Firestore writes for ${operations.length} catalog records...`);
    await commitChunks(db, operations, 400, logger);
    const metadata = {
      id: "current", version: CATALOG_SYNC_VERSION, source: "balldontlie",
      provider: "balldontlie", lastSyncAt: now, updatedAt: now,
      playerCount: merged.players.length + merged.inactive.length,
      activePlayerCount: merged.players.filter((player) => player.active).length,
      syncVersion: CATALOG_SYNC_VERSION, activeMode: directory.activeMode,
      currentSeason: currentPlayerSnapshot.season,
      filteringStrategy,
      providerDirectoryCount: totalProviderPlayers,
      draftEligiblePlayerCount: merged.players.filter((player) => player.draftEligible).length,
      excludedPlayerCount: totalProviderPlayers - candidates.length,
      headshotResolvedCount,
      headshotPlaceholderCount: merged.players.length - headshotResolvedCount,
      headshotVersion: headshotIdentitySnapshot.version,
      capabilities, statsMode: capabilities.enrichedStats ? "available-not-imported" : "directory-baseline",
    };
    await Promise.all([catalogRef.set(metadata, { merge: true }), syncRef.set({ status: "completed", completedAt: now, ...metadata }, { merge: true })]);
    logger("NBA catalog sync complete.");
    return metadata;
  } catch (error) {
    await syncRef.set({ status: "failed", failedAt: new Date().toISOString(), errorCode: error.name || "Error", errorMessage: error.message }, { merge: true });
    throw error;
  }
}
