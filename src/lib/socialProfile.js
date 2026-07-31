export const getPublicProfileMode = (viewerUid, profileUid) => viewerUid === profileUid ? "own" : "public";

export function mergeSocialProfiles(current = [], next = []) {
  const seen = new Set(current.map((profile) => profile.uid));
  return [...current, ...next.filter((profile) => profile?.uid && !seen.has(profile.uid))];
}
