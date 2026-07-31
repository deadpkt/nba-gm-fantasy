export const PROFILE_CROP_OUTPUTS = Object.freeze({
  avatar: { width: 512, height: 512, label: "Profile picture" },
  banner: { width: 1600, height: 500, label: "Profile banner" },
});

export function hasPendingProfileChanges({ displayName = "", savedDisplayName = "", profileImage = null, bannerImage = null }) {
  return Boolean(profileImage || bannerImage || displayName.trim() !== savedDisplayName);
}

export function resolveOwnProfileRoute(viewerUid, profileUid) {
  return viewerUid === profileUid ? "/profile" : null;
}
