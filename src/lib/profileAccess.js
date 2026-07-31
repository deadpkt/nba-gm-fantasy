export const PROFILE_ACCESS = Object.freeze({ LOADING: "loading", LOGIN: "login", OWN: "own", PUBLIC: "public" });

export function resolveProfileAccess({ authLoading, userUid, targetUid = null }) {
  if (authLoading) return PROFILE_ACCESS.LOADING;
  if (!userUid) return PROFILE_ACCESS.LOGIN;
  if (targetUid && targetUid === userUid) return PROFILE_ACCESS.OWN;
  return PROFILE_ACCESS.PUBLIC;
}

export function resolveProfileRoute({ authLoading, userUid, targetUid = null }) {
  const access = resolveProfileAccess({ authLoading, userUid, targetUid });
  return {
    access,
    redirectTo: access === PROFILE_ACCESS.OWN ? "/profile" : access === PROFILE_ACCESS.LOGIN ? "/login" : null,
  };
}
