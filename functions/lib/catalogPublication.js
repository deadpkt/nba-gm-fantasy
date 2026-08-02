import { Timestamp } from "firebase-admin/firestore";
import { buildPublishedCatalogPlayers, catalogPublicationBlockers, compareCatalogVersions, validateRollback } from "../shared/catalogPublication.js";

const assertAdmin = (auth) => { if (!auth?.uid || auth.token?.admin !== true) throw Object.assign(new Error("Catalog publication requires an admin custom claim."), { code: "permission-denied" }); };
const refData = (snapshot) => snapshot.exists ? snapshot.data() : null;

async function resolveCurrentCatalog(db) {
  const pointer = await db.doc("playerCatalogs/current").get();
  const data = refData(pointer) || {};
  const version = data.catalogVersion || "legacy-current";
  const collectionPath = version === "legacy-current" ? "playerCatalogs/current/players" : `playerCatalogs/${version}/players`;
  const players = (await db.collection(collectionPath).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { version, data, players, collectionPath };
}

async function writeCandidatePlayers(db, version, players, batchSize = 350) {
  for (let index = 0; index < players.length; index += batchSize) {
    const batch = db.batch();
    for (const player of players.slice(index, index + batchSize)) batch.create(db.doc(`playerCatalogs/${version}/players/${player.id}`), player);
    await batch.commit();
  }
  const verification = await db.collection(`playerCatalogs/${version}/players`).get();
  if (verification.size !== players.length) throw new Error(`Catalog verification failed: expected ${players.length}, found ${verification.size}.`);
}

export async function publishRatingsPreview({ db, auth, importId, version, confirmation, licensingApproval, notes = "" } = {}) {
  assertAdmin(auth);
  const previewRef = db.doc(`playerDataImports/${importId}`);
  const [previewSnapshot, previewPlayersSnapshot, current] = await Promise.all([previewRef.get(), previewRef.collection("players").get(), resolveCurrentCatalog(db)]);
  if (!previewSnapshot.exists) throw Object.assign(new Error("Ratings preview unavailable."), { code: "not-found" });
  const manifest = previewSnapshot.data();
  const previewPlayers = previewPlayersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const blockers = catalogPublicationBlockers({ manifest, previewPlayers, basePlayers: current.players, version, confirmation, licensingApproval });
  if (blockers.length) return { published: false, blockers };
  const versionRef = db.doc(`playerCatalogs/${version}`);
  if ((await versionRef.get()).exists) return { published: false, blockers: [{ code: "version-exists", message: "Published catalog versions are immutable. Choose a new version." }] };
  const players = buildPublishedCatalogPlayers(current.players, previewPlayers);
  const comparison = compareCatalogVersions(current.players, players);
  await writeCandidatePlayers(db, version, players);
  const now = Timestamp.now();
  const historyRef = db.collection("playerCatalogPublicationHistory").doc();
  const license = { status: "approved", basis: String(licensingApproval.basis).trim(), approvedBy: auth.uid, approvedAt: now };
  const publishedManifest = {
    version, status: "published", provider: manifest.provider, season: manifest.season,
    formulaVersion: manifest.formulaVersion, ratingsVersion: 2, simulationVersion: 1,
    createdAt: manifest.createdAt, publishedAt: now, publishedBy: auth.uid,
    playerCount: players.length, verifiedPlayers: manifest.verifiedCount || 0,
    coverage: manifest.coverage, notes: String(notes || "").trim(), sourceImportId: importId,
    previousVersion: current.version, licensingCheckpoint: license, comparison,
  };
  await db.runTransaction(async (transaction) => {
    const [existingVersion, livePreview] = await Promise.all([transaction.get(versionRef), transaction.get(previewRef)]);
    if (existingVersion.exists) throw new Error("Published catalog versions are immutable.");
    if (!livePreview.exists || livePreview.data().status !== "ready" || livePreview.data().publication?.publishedVersion) throw new Error("This preview is not ready, was already published, or was removed.");
    transaction.create(versionRef, publishedManifest);
    transaction.set(db.doc("playerCatalogs/current"), { catalogVersion: version, ratingsVersion: 2, formulaVersion: manifest.formulaVersion, simulationVersion: 1, activatedAt: now, activatedBy: auth.uid, previousVersion: current.version }, { merge: false });
    transaction.create(historyRef, { action: "publish", fromVersion: current.version, toVersion: version, importId, actorUid: auth.uid, createdAt: now, comparison });
    transaction.update(previewRef, { publication: { enabled: false, publishedVersion: version, publishedAt: now, publishedBy: auth.uid }, licensingCheckpoint: license, archivedAt: now });
  });
  return { published: true, version, previousVersion: current.version, playerCount: players.length, comparison };
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

export { resolveCurrentCatalog };
