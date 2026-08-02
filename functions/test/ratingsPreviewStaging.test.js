import test from "node:test";
import assert from "node:assert/strict";
import { RATINGS_PREVIEW_STAGE_BATCH_SIZE, stageRatingsPreview } from "../lib/generateRatingsPreview.js";

const clone = (value) => value === undefined ? undefined : structuredClone(value);

function createFirestore({ failBatchAt = null, hangBatchAt = null } = {}) {
  const documents = new Map(); const physicalBatchSizes = []; const transactionWrites = [];
  let commitNumber = 0; let failureAt = failBatchAt;
  const snapshot = (path) => ({ exists: documents.has(path), data: () => clone(documents.get(path)) });
  const write = (path, value, options) => documents.set(path, options?.merge ? { ...(documents.get(path) || {}), ...clone(value) } : clone(value));
  const db = {
    doc: (path) => ({ path, get: async () => snapshot(path), set: async (value, options) => write(path, value, options) }),
    batch: () => {
      const pending = [];
      return { set: (ref, value, options) => pending.push({ path: ref.path, value, options }), commit: async () => {
        commitNumber += 1; physicalBatchSizes.push(pending.length);
        if (hangBatchAt === commitNumber) return new Promise(() => {});
        if (failureAt === commitNumber) { failureAt = null; throw Object.assign(new Error("synthetic batch failure"), { code: "invalid-argument" }); }
        pending.forEach((item) => write(item.path, item.value, item.options));
      } };
    },
    runTransaction: async (callback) => {
      const pending = [];
      const result = await callback({ get: async (ref) => snapshot(ref.path), set: (ref, value, options) => pending.push({ path: ref.path, value, options }) });
      transactionWrites.push(...pending); pending.forEach((item) => write(item.path, item.value, item.options)); return result;
    },
  };
  return { db, documents, physicalBatchSizes, transactionWrites, setFailureAt: (value) => { failureAt = value; } };
}

function preview(count = 499) {
  return {
    manifest: { importId: "ratings_2025_large", provider: "balldontlie-goat", season: "2025", formulaVersion: "ratings-v2.0.0", licensingCheckpoint: { status: "required" }, publication: { enabled: false, blockers: ["licensing-checkpoint-required"] } },
    players: Array.from({ length: count }, (_, index) => ({ playerId: `bdl_${index + 1}`, overall: 70 + index % 20, ratingFormulaVersion: "ratings-v2.0.0", ratingsSource: "balldontlie-goat", normalizedInput: { gamesPlayed: 70, nested: { value: index } }, explanations: { overall: { signals: ["fixture"] } } })),
  };
}

const admin = { uid: "admin", token: { admin: true } };

test("499 players stage in bounded groups and finalize only after all writes", async () => {
  const store = createFirestore(); const logs = [];
  const result = await stageRatingsPreview({ db: store.db, auth: admin, preview: preview(), logger: (line) => logs.push(line) });
  assert.equal(RATINGS_PREVIEW_STAGE_BATCH_SIZE, 100);
  assert.equal(result.batchCount, 5); assert.equal(result.playerCount, 499); assert.equal(result.published, false);
  assert.ok(store.physicalBatchSizes.length > 1); assert.ok(store.physicalBatchSizes.every((size) => size <= 100));
  const manifest = store.documents.get("playerDataImports/ratings_2025_large");
  assert.equal(manifest.status, "ready"); assert.equal(manifest.writtenPlayerCount, 499); assert.equal(manifest.stagedPlayerCount, 499);
  assert.equal([...store.documents.keys()].filter((path) => path.includes("/stagingBatches/")).length, 5);
  assert.equal(store.transactionWrites.length, 1); assert.ok(store.transactionWrites.every((write) => !write.path.includes("/players/")));
  assert.equal(store.documents.has("playerCatalogs/current"), false);
  assert.ok(logs.some((line) => /Writing batch 1\/5/.test(line))); assert.ok(logs.includes("Finalizing manifest..."));
  const player = store.documents.get("playerDataImports/ratings_2025_large/players/bdl_1");
  assert.equal(player.importId, "ratings_2025_large"); assert.equal(player.formulaVersion, "ratings-v2.0.0"); assert.equal(player.provider, "balldontlie-goat");
});

test("batch failure leaves a non-ready manifest and retry completes idempotently", async () => {
  const store = createFirestore({ failBatchAt: 2 }); const value = preview(); const logs = [];
  await assert.rejects(() => stageRatingsPreview({ db: store.db, auth: admin, preview: value, logger: (line) => logs.push(line) }), (error) => error.importId === "ratings_2025_large" && error.expectedPlayerCount === 499);
  assert.equal(store.documents.get("playerDataImports/ratings_2025_large").status, "failed");
  const retried = await stageRatingsPreview({ db: store.db, auth: admin, preview: value, logger: (line) => logs.push(line) });
  assert.equal(retried.status, "ready"); assert.equal(store.documents.get("playerDataImports/ratings_2025_large").stagedPlayerCount, 499);
  const commitCount = store.physicalBatchSizes.length;
  const repeated = await stageRatingsPreview({ db: store.db, auth: admin, preview: value, logger: (line) => logs.push(line) });
  assert.equal(repeated.idempotent, true); assert.equal(store.physicalBatchSizes.length, commitCount);
  assert.ok(logs.some((line) => /status failed/.test(line))); assert.ok(logs.some((line) => /already complete/.test(line))); assert.ok(logs.some((line) => /already ready/.test(line)));
});

test("a hanging commit times out and leaves the import failed and retryable", async () => {
  const store = createFirestore({ hangBatchAt: 1 });
  await assert.rejects(() => stageRatingsPreview({ db: store.db, auth: admin, preview: preview(2), commitTimeoutMs: 10 }), (error) => error.code === "deadline-exceeded" && /Batch 1\/1 failed: DEADLINE-EXCEEDED/.test(error.message));
  const manifest = store.documents.get("playerDataImports/ratings_2025_large");
  assert.equal(manifest.status, "failed"); assert.equal(manifest.writtenPlayerCount, 0); assert.match(manifest.stagingFailure.message, /DEADLINE-EXCEEDED/);
});

test("duplicate IDs and mismatched retry source hashes are rejected", async () => {
  const store = createFirestore(); const duplicate = preview(2); duplicate.players[1].playerId = duplicate.players[0].playerId;
  await assert.rejects(() => stageRatingsPreview({ db: store.db, auth: admin, preview: duplicate }), /unique players/i);
  const original = preview(2); await stageRatingsPreview({ db: store.db, auth: admin, preview: original });
  const changed = preview(2); changed.players[0].overall += 1;
  await assert.rejects(() => stageRatingsPreview({ db: store.db, auth: admin, preview: changed }), /different source hash/i);
});

test("the staging implementation uses no BulkWriter queue", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../lib/generateRatingsPreview.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /bulkWriter/i); assert.match(source, /batch\.commit\(\)/);
});
