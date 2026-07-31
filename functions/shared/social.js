const nonNegativeCount = (value) => Number.isInteger(value) && value >= 0 ? value : 0;

export function buildPublicProfile(uid, privateProfile = {}, existing = {}, now = null) {
  return {
    uid,
    displayName: String(privateProfile.displayName || existing.displayName || "Full Court Player").trim().slice(0, 60) || "Full Court Player",
    photoURL: String(privateProfile.photoURL || existing.photoURL || ""),
    bannerURL: String(privateProfile.bannerURL || existing.bannerURL || ""),
    joinedAt: existing.joinedAt || privateProfile.createdAt || now,
    followersCount: nonNegativeCount(existing.followersCount),
    followingCount: nonNegativeCount(existing.followingCount),
    updatedAt: now,
  };
}

export function buildFollowCounts(callerProfile = {}, targetProfile = {}, following) {
  const direction = following ? 1 : -1;
  return {
    callerFollowingCount: Math.max(0, nonNegativeCount(callerProfile.followingCount) + direction),
    targetFollowersCount: Math.max(0, nonNegativeCount(targetProfile.followersCount) + direction),
  };
}

export function buildFollowMutation({ callerProfile = {}, targetProfile = {}, followingEdgeExists = false, followerEdgeExists = false, desiredFollowing }) {
  const consistent = followingEdgeExists === followerEdgeExists;
  const currentlyFollowing = followingEdgeExists || followerEdgeExists;
  if (consistent && currentlyFollowing === desiredFollowing) return { changed: false, following: desiredFollowing };
  return { changed: true, following: desiredFollowing, ...buildFollowCounts(callerProfile, targetProfile, desiredFollowing) };
}

export function validateFollowTarget(callerUid, targetUid) {
  if (typeof targetUid !== "string" || !targetUid.trim()) throw new Error("A target user is required.");
  if (callerUid === targetUid) throw new Error("You cannot follow yourself.");
  return targetUid.trim();
}
