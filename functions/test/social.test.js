import assert from "node:assert/strict";
import test from "node:test";
import { buildFollowCounts, buildFollowMutation, buildPublicProfile, validateFollowTarget } from "../shared/social.js";

test("public projection contains only safe presentation and counter fields", () => {
  const profile = buildPublicProfile("b", { displayName: "B", email: "private@example.com", activeLeagueId: "secret", photoURL: "avatar", bannerURL: "banner" }, {}, 10);
  assert.deepEqual(Object.keys(profile).sort(), ["bannerURL", "displayName", "followersCount", "followingCount", "joinedAt", "photoURL", "uid", "updatedAt"].sort());
  assert.equal(profile.email, undefined);
  assert.equal(profile.activeLeagueId, undefined);
});

test("follow increments once and unfollow never produces negative counts", () => {
  assert.deepEqual(buildFollowCounts({ followingCount: 2 }, { followersCount: 3 }, true), { callerFollowingCount: 3, targetFollowersCount: 4 });
  assert.deepEqual(buildFollowCounts({}, {}, false), { callerFollowingCount: 0, targetFollowersCount: 0 });
});

test("duplicate follow and unfollow retries are idempotent", () => {
  assert.deepEqual(buildFollowMutation({ followingEdgeExists: true, followerEdgeExists: true, desiredFollowing: true }), { changed: false, following: true });
  assert.deepEqual(buildFollowMutation({ followingEdgeExists: false, followerEdgeExists: false, desiredFollowing: false }), { changed: false, following: false });
});

test("both relationship sides are repaired as one mutation", () => {
  const mutation = buildFollowMutation({ callerProfile: { followingCount: 0 }, targetProfile: { followersCount: 0 }, followingEdgeExists: true, followerEdgeExists: false, desiredFollowing: true });
  assert.equal(mutation.changed, true);
  assert.equal(mutation.callerFollowingCount, 1);
  assert.equal(mutation.targetFollowersCount, 1);
});

test("identity uses UID and self-follow is rejected", () => {
  assert.equal(validateFollowTarget("a", "b"), "b");
  assert.throws(() => validateFollowTarget("a", "a"), /yourself/);
  assert.throws(() => validateFollowTarget("a", ""), /required/);
});

test("Follow identity validation has no league or franchise prerequisite", () => {
  assert.equal(validateFollowTarget("new-user-without-league", "different-user-without-league"), "different-user-without-league");
});

test("existing counters and joined date survive projection refresh", () => {
  const profile = buildPublicProfile("a", { displayName: "New" }, { followersCount: 7, followingCount: 4, joinedAt: 1 }, 2);
  assert.equal(profile.followersCount, 7);
  assert.equal(profile.followingCount, 4);
  assert.equal(profile.joinedAt, 1);
});
