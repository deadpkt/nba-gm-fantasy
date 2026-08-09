import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../pages/admin/AdminRatingsPreviewPage.jsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../components/admin/ratings/RatingsReviewPanel.jsx", import.meta.url), "utf8");

test("Ratings Admin defaults to the simplified candidate workflow", () => {
  for (const label of ["CURRENT CANDIDATE", "Previous Imports", "Top Players", "Search Players", "Review & Approval", "Publication Readiness"]) assert.match(`${page}\n${panel}`, new RegExp(label));
});
test("advanced diagnostics remain available but collapsed", () => { assert.match(page, /<details className="ratings-advanced"><summary>Advanced Details/); assert.match(page, /normalizationMetadata/); assert.match(page, /warningResolution/); });
test("review approvals use explicit acknowledgements without typed approval phrases", () => { assert.doesNotMatch(panel, /APPROVE CALIBRATION|APPROVE LICENSE REVIEW/); assert.match(panel, /importScopeConfirmed/); assert.match(panel, /reviewConfirmed/); });
test("publish and rollback keep strong typed confirmations", () => { assert.match(page, /"PUBLISH" : "ROLLBACK"/); assert.match(page, /Confirmation/); });
