export function formatSocialCount(value) {
  const count = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  if (count < 1_000) return String(count);
  const units = count >= 1_000_000 ? [1_000_000, "M"] : [1_000, "K"];
  const scaled = count / units[0];
  const digits = scaled < 100 && !Number.isInteger(scaled) ? 1 : 0;
  return `${scaled.toFixed(digits).replace(/\.0$/, "")}${units[1]}`;
}

export const filterLoadedSocialProfiles = (profiles = [], search = "") => {
  const normalized = search.trim().toLocaleLowerCase();
  return normalized ? profiles.filter((profile) => profile.displayName.toLocaleLowerCase().includes(normalized)) : profiles;
};

export const socialEmptyMessage = (type) => type === "following" ? "Not following anyone yet." : "No followers yet.";

export const SOCIAL_TABS = Object.freeze(["followers", "following"]);
export const normalizeSocialTab = (type) => SOCIAL_TABS.includes(type) ? type : "followers";
export const shouldShowFollowAction = (viewerUid, profileUid) => Boolean(viewerUid && profileUid && viewerUid !== profileUid);
export const followActionLabel = ({ following, pending }) => pending ? "..." : following ? "Following ✓" : "Follow";
