import assert from "node:assert/strict";
import test from "node:test";
import { filterLoadedSocialProfiles, followActionLabel, formatSocialCount, normalizeSocialTab, shouldShowFollowAction, socialEmptyMessage } from "./socialUi.js";

test("social counts remain exact below one thousand and abbreviate cleanly above it", () => {
  assert.equal(formatSocialCount(0), "0");
  assert.equal(formatSocialCount(999), "999");
  assert.equal(formatSocialCount(1_200), "1.2K");
  assert.equal(formatSocialCount(14_800), "14.8K");
  assert.equal(formatSocialCount(1_100_000), "1.1M");
});

test("search filters only the already loaded page", () => {
  const loaded = [{ uid: "a", displayName: "Alex" }, { uid: "b", displayName: "Jordan" }];
  assert.deepEqual(filterLoadedSocialProfiles(loaded, "jor"), [loaded[1]]);
  assert.equal(loaded.length, 2);
});

test("each social tab has a compact safe empty message", () => {
  assert.equal(socialEmptyMessage("followers"), "No followers yet.");
  assert.equal(socialEmptyMessage("following"), "Not following anyone yet.");
});

test("Followers and Following stats resolve their matching modal tabs", () => {
  assert.equal(normalizeSocialTab("followers"), "followers");
  assert.equal(normalizeSocialTab("following"), "following");
  assert.equal(normalizeSocialTab("unknown"), "followers");
});

test("self rows omit Follow while trusted relationship states have clear labels", () => {
  assert.equal(shouldShowFollowAction("a", "a"), false);
  assert.equal(shouldShowFollowAction("a", "b"), true);
  assert.equal(followActionLabel({ following: false, pending: false }), "Follow");
  assert.equal(followActionLabel({ following: true, pending: false }), "Following ✓");
  assert.equal(followActionLabel({ following: true, pending: true }), "...");
});
