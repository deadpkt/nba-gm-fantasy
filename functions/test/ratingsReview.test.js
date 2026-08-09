import test from "node:test";
import assert from "node:assert/strict";
import { approveCalibrationReview, revokeCalibrationReview, setLicensingReview } from "../lib/ratingsReview.js";
import { normalizeRatingsReviews, trustedReviewBlockers, validateCalibrationApproval } from "../shared/ratingsReview.js";
import { RATING_FORMULA_VERSION } from "../shared/playerRatingsV2.js";

const importId = "ratings_2025_review";
const readyImport = () => ({ status: "ready", formulaVersion: RATING_FORMULA_VERSION, provider: "balldontlie-goat", season: 2025, playerCount: 499, expectedPlayerCount: 499, stagedPlayerCount: 499, validationStatus: "eligible-after-licensing-review", coverage: { publicationEligible: true, criticalAnomalyCount: 0 }, anomalySummary: { criticalCount: 0 }, calibrationRealism: { criticalIssues: [], warnings: [] }, warningResolution: { unresolvedCount: 0 } });
const admin = { uid: "admin-1", token: { admin: true } };
const calibrationInput = { topHierarchyReviewed: true, coverageAndAnomalyReviewed: true, importScopeConfirmed: true, notes: "Hierarchy and coverage reviewed." };

function fakeDb(initial = readyImport()) {
  const values = new Map([[`playerDataImports/${importId}`, structuredClone(initial)]]); let sequence = 0;
  const ref = (path) => ({ path, id: path.split("/").at(-1) });
  const snapshot = (path) => ({ exists: values.has(path), data: () => structuredClone(values.get(path)) });
  const writeUpdate = (path, patch) => { const next = structuredClone(values.get(path) || {}); for (const [key, value] of Object.entries(patch)) { const parts = key.split("."); let target = next; for (const part of parts.slice(0, -1)) target = target[part] ||= {}; target[parts.at(-1)] = value; } values.set(path, next); };
  return { values, doc: ref, collection: (path) => ({ doc: () => ref(`${path}/event-${++sequence}`) }), runTransaction: async (callback) => callback({ get: async (item) => snapshot(item.path), update: (item, patch) => writeUpdate(item.path, patch), create: (item, value) => { if (values.has(item.path)) throw new Error("exists"); values.set(item.path, value); } }) };
}

test("old imports default both reviews to pending", () => assert.deepEqual(normalizeRatingsReviews(), { calibration: { status: "pending" }, licensing: { status: "pending" } }));
test("non-admin calibration approval fails", async () => assert.rejects(() => approveCalibrationReview({ db: fakeDb(), auth: { uid: "member", token: {} }, importId, input: calibrationInput }), /Only admins/));
test("not-ready import and critical issues block calibration", () => {
  assert.throws(() => validateCalibrationApproval({ importId, item: { ...readyImport(), status: "staging" }, input: calibrationInput }), /not ready/);
  assert.throws(() => validateCalibrationApproval({ importId, item: { ...readyImport(), calibrationRealism: { criticalIssues: [{}] } }, input: calibrationInput }), /critical issues/);
});
test("calibration uses explicit review acknowledgements without typed confirmation", () => { assert.doesNotThrow(() => validateCalibrationApproval({ importId, item: readyImport(), input: calibrationInput })); assert.throws(() => validateCalibrationApproval({ importId, item: readyImport(), input: { ...calibrationInput, importScopeConfirmed: false } }), /Complete every/); });
test("admin calibration approval and revocation are trusted and audited", async () => {
  const db = fakeDb(); const approved = await approveCalibrationReview({ db, auth: admin, importId, input: calibrationInput });
  assert.equal(approved.status, "approved"); assert.equal(db.values.get(`playerDataImports/${importId}`).reviews.calibration.reviewedBy, admin.uid);
  assert.equal([...db.values.keys()].filter((key) => key.startsWith("playerDataImportReviewHistory/")).length, 1);
  const revoked = await revokeCalibrationReview({ db, auth: admin, importId, input: { notes: "Re-review required." } });
  assert.equal(revoked.status, "revoked"); assert.equal(db.values.get(`playerDataImports/${importId}`).reviews.calibration.status, "revoked");
});
test("licensing basis is required and approval, rejection, and revocation are audited", async () => {
  await assert.rejects(() => setLicensingReview({ db: fakeDb(), auth: admin, importId, input: { action: "approve", basis: "", scope: "Internal", attributionRequired: false, reviewConfirmed: true } }), /basis is required/);
  await assert.rejects(() => setLicensingReview({ db: fakeDb(), auth: admin, importId, input: { action: "approve", basis: "Reviewed", scope: "Internal", attributionRequired: false, reviewConfirmed: false } }), /Confirm the completed/);
  const db = fakeDb();
  const approved = await setLicensingReview({ db, auth: admin, importId, input: { action: "approve", basis: "Organization review completed", scope: "Internal fantasy product", attributionRequired: false, reviewConfirmed: true } });
  assert.equal(approved.status, "approved");
  const revoked = await setLicensingReview({ db, auth: admin, importId, input: { action: "revoke", notes: "Scope changed" } }); assert.equal(revoked.status, "revoked");
  const rejectedDb = fakeDb(); const rejected = await setLicensingReview({ db: rejectedDb, auth: admin, importId, input: { action: "reject", basis: "Rights not confirmed", scope: "Internal fantasy product", attributionRequired: false, reviewConfirmed: true } }); assert.equal(rejected.status, "rejected");
});
test("both context-bound approvals are required and stale or revoked reviews block publication", async () => {
  const db = fakeDb(); await approveCalibrationReview({ db, auth: admin, importId, input: calibrationInput }); await setLicensingReview({ db, auth: admin, importId, input: { action: "approve", basis: "Reviewed", scope: "Internal", attributionRequired: false, reviewConfirmed: true } });
  const item = db.values.get(`playerDataImports/${importId}`); assert.deepEqual(trustedReviewBlockers(importId, item), []);
  assert.ok(trustedReviewBlockers(importId, { ...item, formulaVersion: "ratings-v9" }).some((row) => row.code.startsWith("stale-")));
  await setLicensingReview({ db, auth: admin, importId, input: { action: "revoke" } }); assert.ok(trustedReviewBlockers(importId, db.values.get(`playerDataImports/${importId}`)).some((row) => row.code === "licensing-review-revoked"));
});
test("approval functions do not publish a catalog or activate Simulation V2", async () => {
  const db = fakeDb(); await approveCalibrationReview({ db, auth: admin, importId, input: calibrationInput });
  assert.equal([...db.values.keys()].some((key) => key.startsWith("playerCatalogs/")), false);
  assert.equal([...db.values.values()].some((value) => value?.simulationVersion === 2), false);
});
