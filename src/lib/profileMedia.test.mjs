import assert from "node:assert/strict";
import test from "node:test";
import { hasPendingProfileChanges, PROFILE_CROP_OUTPUTS, resolveOwnProfileRoute } from "./profileMedia.js";

test("Profile, Settings, and another public profile remain distinct destinations", () => {
  assert.equal(resolveOwnProfileRoute("a", "a"), "/profile");
  assert.equal(resolveOwnProfileRoute("a", "b"), null);
  assert.notEqual("/profile", "/settings");
});

test("existing avatar and banner crop specifications remain unchanged", () => {
  assert.deepEqual(PROFILE_CROP_OUTPUTS.avatar, { width: 512, height: 512, label: "Profile picture" });
  assert.deepEqual(PROFILE_CROP_OUTPUTS.banner, { width: 1600, height: 500, label: "Profile banner" });
});

test("confirmed media or a changed public name creates a pending save", () => {
  assert.equal(hasPendingProfileChanges({ displayName: "GM", savedDisplayName: "GM" }), false);
  assert.equal(hasPendingProfileChanges({ displayName: "New GM", savedDisplayName: "GM" }), true);
  assert.equal(hasPendingProfileChanges({ displayName: "GM", savedDisplayName: "GM", profileImage: {} }), true);
  assert.equal(hasPendingProfileChanges({ displayName: "GM", savedDisplayName: "GM", bannerImage: {} }), true);
});
