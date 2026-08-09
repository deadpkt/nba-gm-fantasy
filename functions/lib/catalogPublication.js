import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { buildPublishedCatalogPlayers, catalogPublicationBlockers, compareCatalogVersions, validateRollback } from "../shared/catalogPublication.js";

export const CATALOG_PUBLICATION_BATCH_SIZE = 150;
const assertAdmin = (auth) => { if (!auth?.uid || auth.token?.admin !== true) throw Object.assign(new Error("Catalog publication requires an admin custom claim."), { code: "permission-denied" }); };
const refData = (snapshot) => snapshot.exists ? snapshot.data() : null;
const hashValue = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const safeFailure = (error) => ({ code: String(error?.code || "catalog-publication-failed").slice(0, 80), message: String(error?.message || "Catalog publication failed.").replace(/[\r\n]+/g, " ").slice(0, 300) });
const batchId = (index) => String(index).padStart(4, "0");

async function resolveCurrentCatalogPointer(db) {
  const pointer = await db.doc("playerCatalogs/current").get();
  const data = refData(pointer) || {};
  const version = data.catalogVersion || "legacy-current";
  return { version, data, collectionPath: version === "legacy-current" ? "playerCatalogs/current/players" : `playerCatalogs/${version}/players` };
}

async function loadCanonicalPlayers(db, collectionPath, playerIds, readBatchSize = 150) {
  const players = [];
  for (let index = 0; index < playerIds.length; index += readBatchSize) {
    const refs = playerIds.slice(index, index + readBatchSize).map((id) => db.doc(`${collectionPath}/${id}`));
    const snapshots = typeof db.getAll === "function" ? await db.getAll(...refs) : await Promise.all(refs.map((ref) => ref.get()));
    for (const snapshot of snapshots) if (snapshot.exists) players.push({ id: snapshot.id || snapshot.ref?.id, ...snapshot.data() });
  }
  return players;
}

async function resolvePublicationInputs(db, previewRef) {
  const [previewSnapshot, previewPlayersSnapshot] = await Promise.all([previewRef.get(), previewRef.collection("players").get()]);
  if (!previewSnapshot.exists) throw Object.assign(new Error("Ratings preview unavailable."), { code: "not-found" });
  const previewPlayers = previewPlayersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const current = await resolveCurrentCatalogPointer(db);
  const basePlayers = await loadCanonicalPlayers(db, current.collectionPath, previewPlayers.map((player) => String(player.playerId)));
  return { manifest: previewSnapshot.data(), previewPlayers, current, basePlayers };
}

function buildPublishGroups(players, publishHash, batchSize) {
  const groups = [];
  for (let index = 0; index < players.length; index += batchSize) {
    const rows = players.slice(index, index + batchSize);
    groups.push({ index: groups.length, players: rows, checksum: hashValue(rows), publishHash });
  }
  return groups;
}

async function prepareCandidate({ versionRef, version, importId, manifest, currentVersion, players, publishHash, batchCount, actorUid }) {
  const existingSnapshot = await versionRef.get();
  if (existingSnapshot.exists) {
    const existing = existingSnapshot.data();
    if (existing.status === "published") {
      if (existing.sourceImportId === importId && existing.publishHash === publishHash) return { alreadyPublished: true, manifest: existing };
      return { blockers: [{ code: "version-exists", message: "Published catalog versions are immutable. Choose a new version." }] };
    }
    if (existing.sourceImportId !== importId || existing.publishHash !== publishHash) return { blockers: [{ code: "version-conflict", message: "That catalog version belongs to a different import or candidate payload." }] };
  }
  const now = Timestamp.now();
  await versionRef.set({
    version, status: "publishing", provider: manifest.provider, season: manifest.season, formulaVersion: manifest.formulaVersion,
    ratingsVersion: 2, simulationVersion: 1, sourceImportId: importId, previousVersion: currentVersion,
    publishHash, expectedPlayerCount: players.length, publishedPlayerCount: existingSnapshot.data()?.publishedPlayerCount || 0,
    publishBatchCount: batchCount, completedBatchCount: existingSnapshot.data()?.completedBatchCount || 0,
    startedAt: existingSnapshot.data()?.startedAt || now, lastProgressAt: now, publishedAt: null,
    publishFailure: null, publishingBy: actorUid,
  }, { merge: true });
  return { alreadyPublished: false };
}

async function writeCandidateGroups({ db, version, versionRef, groups, logger }) {
  let completedBatchCount = 0;
  let publishedPlayerCount = 0;
  for (const group of groups) {
    const ledgerRef = db.doc(`playerCatalogs/${version}/publishBatches/${batchId(group.index)}`);
    const ledgerSnapshot = await ledgerRef.get();
    const ledger = refData(ledgerSnapshot);
    if (ledger?.status === "complete" && ledger.publishHash === group.publishHash && ledger.checksum === group.checksum && ledger.playerCount === group.players.length) {
      completedBatchCount += 1; publishedPlayerCount += group.players.length;
      logger(`Batch ${group.index + 1}/${groups.length} already complete (${publishedPlayerCount}/${groups.reduce((sum, item) => sum + item.players.length, 0)} players).`);
      continue;
    }
    logger(`Writing batch ${group.index + 1}/${groups.length}...`);
    const batch = db.batch();
    for (const player of group.players) batch.set(db.doc(`playerCatalogs/${version}/players/${player.id}`), player, { merge: false });
    batch.set(ledgerRef, { index: group.index, status: "complete", playerCount: group.players.length, checksum: group.checksum, publishHash: group.publishHash, completedAt: Timestamp.now() }, { merge: false });
    await batch.commit();
    completedBatchCount += 1; publishedPlayerCount += group.players.length;
    await db.runTransaction(async (transaction) => {
      const candidate = await transaction.get(versionRef);
      if (candidate.exists && candidate.data().status !== "published") transaction.set(versionRef, { status: "publishing", completedBatchCount, publishedPlayerCount, lastProgressAt: Timestamp.now(), publishFailure: null }, { merge: true });
    });
    logger(`Completed ${publishedPlayerCount}/${groups.reduce((sum, item) => sum + item.players.length, 0)} players.`);
  }
  return { completedBatchCount, publishedPlayerCount };
}

async function countCandidatePlayers(db, version) {
  const collection = db.collection(`playerCatalogs/${version}/players`);
  if (typeof collection.count === "function") return (await collection.count().get()).data().count;
  return (await collection.get()).size;
}

async function verifyCandidate({ db, version, groups, expectedPlayerCount, publishHash }) {
  const ledgerSnapshots = await Promise.all(groups.map((group) => db.doc(`playerCatalogs/${version}/publishBatches/${batchId(group.index)}`).get()));
  const verified = ledgerSnapshots.reduce((total, snapshot, index) => {
    const ledger = refData(snapshot); const group = groups[index];
    if (!ledger || ledger.status !== "complete" || ledger.publishHash !== publishHash || ledger.checksum !== group.checksum || ledger.playerCount !== group.players.length) throw new Error(`Catalog publication batch ${index + 1} is incomplete or mismatched.`);
    return total + ledger.playerCount;
  }, 0);
  const storedCount = await countCandidatePlayers(db, version);
  if (verified !== expectedPlayerCount || storedCount !== expectedPlayerCount) throw new Error(`Catalog verification failed: expected ${expectedPlayerCount}, verified ${verified}, stored ${storedCount}.`);
  return storedCount;
}

async function markCandidateFailed({ versionRef, error, publishedPlayerCount, expectedPlayerCount, logger }) {
  const snapshot = await versionRef.get().catch(() => null);
  const durableCount = Math.max(publishedPlayerCount || 0, snapshot?.data()?.publishedPlayerCount || 0);
  if (snapshot?.exists && snapshot.data().status !== "published") await versionRef.set({ status: "failed", publishedPlayerCount: durableCount, expectedPlayerCount, lastProgressAt: Timestamp.now(), publishFailure: safeFailure(error) }, { merge: true }).catch(() => {});
  logger(`Publication failed after ${durableCount}/${expectedPlayerCount} players. Current pointer unchanged. Candidate version: ${versionRef.id}`);
}

export async function publishRatingsPreview({ db, auth, importId, version, confirmation, licensingApproval, notes = "", batchSize = CATALOG_PUBLICATION_BATCH_SIZE, logger = console.info } = {}) {
  assertAdmin(auth);
  if (!Number.isInteger(batchSize) || batchSize < 100 || batchSize > 200) throw new Error("Catalog publication batch size must be between 100 and 200.");
  logger(`Publishing catalog ${version} from ${importId}`);
  const previewRef = db.doc(`playerDataImports/${importId}`);
  const { manifest, previewPlayers, current, basePlayers } = await resolvePublicationInputs(db, previewRef);
  const blockers = catalogPublicationBlockers({ importId, manifest, previewPlayers, basePlayers, version, confirmation, licensingApproval });
  if (blockers.length) return { published: false, status: "blocked", blockers };
  const players = buildPublishedCatalogPlayers(basePlayers, previewPlayers);
  const comparison = compareCatalogVersions(basePlayers, players);
  const publishHash = hashValue({ importId, version, formulaVersion: manifest.formulaVersion, provider: manifest.provider, season: manifest.season, players });
  const groups = buildPublishGroups(players, publishHash, batchSize);
  const versionRef = db.doc(`playerCatalogs/${version}`);
  const prepared = await prepareCandidate({ versionRef, version, importId, manifest, currentVersion: current.version, players, publishHash, batchCount: groups.length, actorUid: auth.uid });
  if (prepared.blockers) return { published: false, status: "blocked", blockers: prepared.blockers };
  if (prepared.alreadyPublished) return { published: true, status: "published", catalogVersion: version, version, previousVersion: prepared.manifest.previousVersion, playerCount: prepared.manifest.playerCount, alreadyPublished: true };
  let progress = { publishedPlayerCount: 0, completedBatchCount: 0 };
  try {
    progress = await writeCandidateGroups({ db, version, versionRef, groups, logger });
    logger("Final verification...");
    await verifyCandidate({ db, version, groups, expectedPlayerCount: players.length, publishHash });
    logger("Activating pointer...");
    const now = Timestamp.now();
    const historyRef = db.doc(`playerCatalogPublicationHistory/publish_${String(version).replace(/[^A-Za-z0-9_-]/g, "_")}`);
    const license = { status: "approved", basis: String(licensingApproval.basis).trim(), approvedBy: auth.uid, approvedAt: now };
    const publishedManifest = {
      version, status: "published", provider: manifest.provider, season: manifest.season, formulaVersion: manifest.formulaVersion,
      ratingsVersion: 2, simulationVersion: 1, createdAt: manifest.createdAt, publishedAt: now, publishedBy: auth.uid,
      playerCount: players.length, expectedPlayerCount: players.length, publishedPlayerCount: players.length,
      publishBatchCount: groups.length, completedBatchCount: groups.length, startedAt: null, lastProgressAt: now,
      verifiedPlayers: manifest.verifiedCount || 0, coverage: manifest.coverage, notes: String(notes || "").trim(),
      sourceImportId: importId, previousVersion: current.version, licensingCheckpoint: license, comparison, publishHash, publishFailure: null,
    };
    await db.runTransaction(async (transaction) => {
      const [candidateSnapshot, livePreview, livePointer, historySnapshot] = await Promise.all([transaction.get(versionRef), transaction.get(previewRef), transaction.get(db.doc("playerCatalogs/current")), transaction.get(historyRef)]);
      const candidate = refData(candidateSnapshot), live = refData(livePreview), pointer = refData(livePointer) || {};
      if (candidate?.status === "published" && candidate.sourceImportId === importId && historySnapshot.exists) return;
      if (!candidate || candidate.status !== "publishing" || candidate.publishHash !== publishHash || candidate.publishedPlayerCount !== players.length || candidate.completedBatchCount !== groups.length) throw new Error("Catalog candidate is not completely verified.");
      if (!live || live.status !== "ready" || live.publication?.publishedVersion) throw new Error("This preview is not ready, was already published, or was removed.");
      if ((pointer.catalogVersion || "legacy-current") !== current.version) throw new Error("The current catalog changed during publication. Retry from the new current version.");
      const liveReviewBlockers = catalogPublicationBlockers({ importId, manifest: live, previewPlayers, basePlayers, version, confirmation, licensingApproval }).filter((item) => ["calibration-review-required", "stale-calibration-review", "licensing-checkpoint-required", "licensing-review-revoked", "stale-licensing-review"].includes(item.code));
      if (liveReviewBlockers.length) throw new Error(liveReviewBlockers.map((item) => item.message).join(" "));
      transaction.set(versionRef, { ...publishedManifest, startedAt: candidate.startedAt || now }, { merge: false });
      transaction.set(db.doc("playerCatalogs/current"), { catalogVersion: version, ratingsVersion: 2, formulaVersion: manifest.formulaVersion, simulationVersion: 1, activatedAt: now, activatedBy: auth.uid, previousVersion: current.version }, { merge: false });
      if (!historySnapshot.exists) transaction.create(historyRef, { action: "publish", fromVersion: current.version, toVersion: version, importId, actorUid: auth.uid, createdAt: now, comparison });
      transaction.update(previewRef, { publication: { enabled: false, publishedVersion: version, publishedAt: now, publishedBy: auth.uid }, licensingCheckpoint: license, archivedAt: now });
    });
    logger("Publication complete.");
    return { published: true, status: "published", catalogVersion: version, version, previousVersion: current.version, playerCount: players.length, comparison };
  } catch (error) {
    const finalSnapshot = await versionRef.get().catch(() => null);
    if (finalSnapshot?.exists && finalSnapshot.data().status === "published" && finalSnapshot.data().sourceImportId === importId) return { published: true, status: "published", catalogVersion: version, version, previousVersion: finalSnapshot.data().previousVersion, playerCount: finalSnapshot.data().playerCount, alreadyPublished: true };
    await markCandidateFailed({ versionRef, error, publishedPlayerCount: progress.publishedPlayerCount, expectedPlayerCount: players.length, logger });
    throw error;
  }
}

export async function rollbackPlayerCatalog({ db, auth, targetVersion, confirmation, notes = "" } = {}) {
  assertAdmin(auth);
  const pointerRef = db.doc("playerCatalogs/current");
  const targetRef = db.doc(`playerCatalogs/${targetVersion}`);
  const legacyAvailable = targetVersion === "legacy-current" && !(await db.collection("playerCatalogs/current/players").limit(1).get()).empty;
  return db.runTransaction(async (transaction) => {
    const [pointerSnapshot, targetSnapshot] = await Promise.all([transaction.get(pointerRef), transaction.get(targetRef)]);
    const currentVersion = pointerSnapshot.data()?.catalogVersion || "legacy-current";
    const blockers = validateRollback({ targetVersion, currentVersion, confirmation });
    if (!legacyAvailable && (!targetSnapshot.exists || targetSnapshot.data().status !== "published")) blockers.push({ code: "target-not-published", message: "Rollback target is not a published immutable catalog." });
    if (blockers.length) return { rolledBack: false, blockers };
    const now = Timestamp.now();
    const target = legacyAvailable ? { ratingsVersion: 1, formulaVersion: "legacy-v1", simulationVersion: 1 } : targetSnapshot.data();
    transaction.set(pointerRef, { catalogVersion: targetVersion, ratingsVersion: target.ratingsVersion, formulaVersion: target.formulaVersion, simulationVersion: target.simulationVersion || 1, activatedAt: now, activatedBy: auth.uid, previousVersion: currentVersion }, { merge: false });
    transaction.create(db.collection("playerCatalogPublicationHistory").doc(), { action: "rollback", fromVersion: currentVersion, toVersion: targetVersion, actorUid: auth.uid, createdAt: now, notes: String(notes || "").trim() });
    return { rolledBack: true, version: targetVersion, previousVersion: currentVersion };
  });
}

export async function resolveCurrentCatalog(db) {
  const current = await resolveCurrentCatalogPointer(db);
  const players = (await db.collection(current.collectionPath).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { ...current, players };
}

export { buildPublishGroups, countCandidatePlayers, loadCanonicalPlayers, verifyCandidate, writeCandidateGroups };
