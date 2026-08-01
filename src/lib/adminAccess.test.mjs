import assert from "node:assert/strict";
import test from "node:test";
import { hasAdminClaim, resolveAdminRoute } from "./adminAccess.js";

test("only an explicit Firebase admin custom claim grants admin access", () => {
  assert.equal(hasAdminClaim({ claims: { admin: true } }), true);
  assert.equal(hasAdminClaim({ claims: { admin: false } }), false);
  assert.equal(hasAdminClaim({ claims: { isAdmin: true } }), false);
  assert.equal(hasAdminClaim(null), false);
});

test("admin route waits for claims and denies normal users", () => {
  assert.equal(resolveAdminRoute({ loading: true, admin: false }), "loading");
  assert.equal(resolveAdminRoute({ loading: false, admin: false }), "denied");
  assert.equal(resolveAdminRoute({ loading: false, admin: true }), "allowed");
});
