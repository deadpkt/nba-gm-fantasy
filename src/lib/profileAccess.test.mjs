import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE_ACCESS, resolveProfileAccess, resolveProfileRoute } from "./profileAccess.js";
import { getInternalReturnPath } from "./routeAccess.js";

test("authenticated users access profiles without any league state", () => {
  assert.equal(resolveProfileAccess({ authLoading: false, userUid: "viewer", targetUid: "target" }), PROFILE_ACCESS.PUBLIC);
  assert.equal(resolveProfileAccess({ authLoading: false, userUid: "viewer" }), PROFILE_ACCESS.PUBLIC);
});

test("own UID resolves to the owner profile independently of league hydration", () => {
  assert.equal(resolveProfileAccess({ authLoading: false, userUid: "viewer", targetUid: "viewer" }), PROFILE_ACCESS.OWN);
  assert.deepEqual(resolveProfileRoute({ authLoading: false, userUid: "viewer", targetUid: "viewer" }), { access: PROFILE_ACCESS.OWN, redirectTo: "/profile" });
  assert.notEqual(resolveProfileRoute({ authLoading: false, userUid: "viewer", targetUid: "viewer" }).redirectTo, "/settings");
});

test("owner and public routes have stable terminal states without league context", () => {
  assert.deepEqual(resolveProfileRoute({ authLoading: false, userUid: "viewer" }), { access: PROFILE_ACCESS.PUBLIC, redirectTo: null });
  assert.deepEqual(resolveProfileRoute({ authLoading: false, userUid: "viewer", targetUid: "other" }), { access: PROFILE_ACCESS.PUBLIC, redirectTo: null });
});

test("signed-out deep links wait for Auth and preserve the target path", () => {
  assert.equal(resolveProfileAccess({ authLoading: true, userUid: null, targetUid: "target" }), PROFILE_ACCESS.LOADING);
  assert.equal(resolveProfileAccess({ authLoading: false, userUid: null, targetUid: "target" }), PROFILE_ACCESS.LOGIN);
  assert.equal(getInternalReturnPath({ pathname: "/profile/target" }), "/profile/target");
});
