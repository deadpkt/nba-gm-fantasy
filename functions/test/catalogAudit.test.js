import assert from "node:assert/strict";
import test from "node:test";
import { auditCanonicalCatalog } from "../shared/catalogAudit.js";
import { createHeadshotIdentityLookup } from "../shared/nbaCatalog.js";

test("catalog audit reports duplicates, manual eligibility, and headshot coverage", () => {
  const lookup = createHeadshotIdentityLookup([{ name: "Canonical Star", nbaPlayerId: "99", team: "ONE" }]);
  const players = [
    { documentId: "one", name: "Canonical Star", firstName: "Canonical", lastName: "Star", team: "ONE", active: true, draftEligible: true, source: { provider: "balldontlie", externalId: 1 } },
    { documentId: "two", name: "Canonical Star", firstName: "Canonical", lastName: "Star", team: "TWO", active: true, draftEligible: true, source: { provider: "balldontlie", externalId: 2 } },
    { documentId: "manual", name: "Manual Player", active: true, draftEligible: true, source: { provider: "manual" } },
    { documentId: "inactive", name: "Historical", active: false, draftEligible: false },
  ];
  const audit = auditCanonicalCatalog(players, lookup);
  assert.equal(audit.total, 4);
  assert.equal(audit.eligible, 3);
  assert.equal(audit.duplicates.length, 1);
  assert.equal(audit.manualOnlyEligible.length, 1);
  assert.equal(audit.headshotResolved, 2);
  assert.equal(audit.placeholder, 1);
});
