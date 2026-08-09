import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publishRatingsPreview } from "../lib/catalogPublication.js";
import { RATING_FORMULA_VERSION } from "../shared/playerRatingsV2.js";

const importId = "ratings_2025_publish";
const version = "2026.1";
const auth = { uid: "admin", token: { admin: true } };
const ratingKeys = ["overall", "rimScoring", "midRange", "threePoint", "freeThrow", "playmaking", "ballHandling", "turnoverControl", "perimeterDefense", "interiorDefense", "steal", "block", "offensiveRebounding", "defensiveRebounding", "athleticism", "stamina", "consistency"];
const ratings = (overall = 80) => ({ version: 2, source: "verified-season-stats:balldontlie", ...Object.fromEntries(ratingKeys.map((key) => [key, overall])) });
const manifest = (count = 499) => ({
  status: "ready", formulaVersion: RATING_FORMULA_VERSION, provider: "verified-season-stats:balldontlie", season: 2025,
  playerCount: count, expectedPlayerCount: count, stagedPlayerCount: count, validationStatus: "eligible-after-licensing-review",
  coverage: { publicationEligible: true, criticalAnomalyCount: 0, duplicateIdentityCount: 0, duplicateProviderIdCount: 0, missingPositionCount: 0, malformedRatingCount: 0 }, anomalySummary: { criticalCount: 0 },
  reviews: { calibration: { status: "approved", importId, formulaVersion: RATING_FORMULA_VERSION, reviewedPlayerCount: count }, licensing: { status: "approved", importId, formulaVersion: RATING_FORMULA_VERSION, provider: "verified-season-stats:balldontlie", season: 2025, basis: "Internal review" } },
});

function fakeDb(count = 499) {
  const documents = new Map([["playerCatalogs/current", { catalogVersion: "legacy-current" }], [`playerDataImports/${importId}`, manifest(count)]]);
  for (let index = 0; index < count; index += 1) {
    const id = `p${String(index).padStart(3, "0")}`;
    documents.set(`playerCatalogs/current/players/${id}`, { name: `Player ${index}`, primaryPosition: "PG", eligiblePositions: ["PG"], overall: 70, active: true, draftEligible: true });
    documents.set(`playerDataImports/${importId}/players/${id}`, { playerId: id, name: `Player ${index}`, primaryPosition: "PG", eligiblePositions: ["PG"], overall: 80, ratingsVersion: 2, ratings: ratings(), ratingsStatus: "verified", ratingFormulaVersion: RATING_FORMULA_VERSION });
  }
  const state = { documents, batchSizes: [], batchCommit: 0, failBatch: null };
  const directDocs = (path) => [...documents.entries()].filter(([key]) => key.startsWith(`${path}/`) && key.slice(path.length + 1).split("/").length === 1);
  const snapshot = (path) => ({ exists: documents.has(path), id: path.split("/").at(-1), ref: { id: path.split("/").at(-1), path }, data: () => documents.get(path) });
  const applySet = (path, value, options = {}) => documents.set(path, options.merge ? { ...(documents.get(path) || {}), ...value } : value);
  const applyUpdate = (path, value) => { const next = { ...(documents.get(path) || {}) }; for (const [key, item] of Object.entries(value)) { const parts = key.split("."); let target = next; for (const part of parts.slice(0, -1)) target = target[part] ||= {}; target[parts.at(-1)] = item; } documents.set(path, next); };
  const collectionRef = (path) => ({
    path, doc: (id = `auto-${documents.size}`) => docRef(`${path}/${id}`),
    async get() { const rows = directDocs(path); return { size: rows.length, empty: rows.length === 0, docs: rows.map(([key]) => snapshot(key)) }; },
    count() { return { get: async () => ({ data: () => ({ count: directDocs(path).length }) }) }; },
    limit() { return { get: async () => { const rows = directDocs(path).slice(0, 1); return { size: rows.length, empty: rows.length === 0, docs: rows.map(([key]) => snapshot(key)) }; } }; },
  });
  const docRef = (path) => ({ path, id: path.split("/").at(-1), get: async () => snapshot(path), set: async (value, options) => applySet(path, value, options), collection: (name) => collectionRef(`${path}/${name}`) });
  const db = {
    ...state, doc: docRef, collection: collectionRef, getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
    batch() { const writes = []; return { set: (ref, value, options) => writes.push({ ref, value, options }), async commit() { state.batchCommit += 1; state.batchSizes.push(writes.length); if (state.failBatch === state.batchCommit) throw Object.assign(new Error("synthetic batch failure"), { code: "unavailable" }); writes.forEach((write) => applySet(write.ref.path, write.value, write.options)); } }; },
    runTransaction: async (callback) => callback({ get: async (ref) => snapshot(ref.path), set: (ref, value, options) => applySet(ref.path, value, options), create: (ref, value) => { if (documents.has(ref.path)) throw new Error("already exists"); documents.set(ref.path, value); }, update: (ref, value) => applyUpdate(ref.path, value) }),
  };
  Object.defineProperty(db, "failBatch", { get: () => state.failBatch, set: (value) => { state.failBatch = value; } });
  Object.defineProperty(db, "batchCommit", { get: () => state.batchCommit });
  return db;
}

const input = { auth, importId, version, confirmation: `PUBLISH ${version}`, licensingApproval: { basis: "Internal review completed" }, logger: () => {} };

test("499-player publication uses bounded batches and activates only after verification", async () => {
  const db = fakeDb(); const result = await publishRatingsPreview({ db, ...input });
  assert.equal(result.status, "published"); assert.equal(result.playerCount, 499); assert.equal(db.documents.get("playerCatalogs/current").catalogVersion, version);
  assert.deepEqual(db.batchSizes, [151, 151, 151, 50]);
  assert.equal(db.documents.get(`playerCatalogs/${version}`).completedBatchCount, 4);
});

test("batch failure leaves pointer unchanged and retry resumes without duplicate history", async () => {
  const db = fakeDb(); db.failBatch = 2;
  await assert.rejects(() => publishRatingsPreview({ db, ...input }), /synthetic batch failure/);
  assert.equal(db.documents.get("playerCatalogs/current").catalogVersion, "legacy-current");
  assert.equal(db.documents.get(`playerCatalogs/${version}`).status, "failed"); assert.equal(db.documents.get(`playerCatalogs/${version}`).publishedPlayerCount, 150);
  db.failBatch = null; const result = await publishRatingsPreview({ db, ...input }); assert.equal(result.status, "published");
  const histories = [...db.documents.keys()].filter((key) => key.startsWith("playerCatalogPublicationHistory/")); assert.equal(histories.length, 1);
  const duplicate = await publishRatingsPreview({ db, ...input }); assert.equal(duplicate.alreadyPublished, true); assert.equal([...db.documents.keys()].filter((key) => key.startsWith("playerCatalogPublicationHistory/")).length, 1);
});

test("publish timeout is isolated and rollback keeps its default callable configuration", async () => {
  const source = await readFile(new URL("../index.js", import.meta.url), "utf8");
  assert.match(source, /publishPlayerCatalog = onCall\(\{ timeoutSeconds: 900, memory: "1GiB" \}/);
  assert.match(source, /rollbackPlayerCatalogVersion = onCall\(async/);
});

export { fakeDb };
