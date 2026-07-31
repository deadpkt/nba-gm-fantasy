import assert from "node:assert/strict";
import test from "node:test";
import { getPublicProfileMode, mergeSocialProfiles } from "./socialProfile.js";

test("own profile resolves to edit mode while another UID resolves public Follow mode", () => {
  assert.equal(getPublicProfileMode("a", "a"), "own");
  assert.equal(getPublicProfileMode("a", "b"), "public");
});

test("bounded list pages append without duplicate users", () => {
  assert.deepEqual(mergeSocialProfiles([{ uid: "a" }], [{ uid: "a" }, { uid: "b" }]), [{ uid: "a" }, { uid: "b" }]);
});
