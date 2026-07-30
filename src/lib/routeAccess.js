import { LEAGUE_STATUS } from "./leagueStatuses.js";

export const ROUTE_ACCESS = Object.freeze({ LOADING: "loading", ALLOWED: "allowed", REDIRECT: "redirect" });

export function getInternalReturnPath(from) {
  const pathname = typeof from?.pathname === "string" ? from.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  const search = typeof from?.search === "string" && from.search.startsWith("?") ? from.search : "";
  const hash = typeof from?.hash === "string" && from.hash.startsWith("#") ? from.hash : "";
  return `${pathname}${search}${hash}`;
}

export function resolveLeagueRouteAccess({ leagueLoading, activeLeagueId, activeLeague, userId, requireActive = true, requireMember = true, commissionerOnly = false, allowedStatuses, pathname = "" } = {}) {
  if (leagueLoading) return { status: ROUTE_ACCESS.LOADING, redirectTo: null };
  if (requireActive && (!activeLeagueId || !activeLeague)) return { status: ROUTE_ACCESS.REDIRECT, redirectTo: "/league", reason: "missing-league" };
  const leagueDashboard = activeLeagueId ? `/league/${activeLeagueId}` : "/league";
  const phaseDestination = activeLeague?.status === LEAGUE_STATUS.SEASON_READY ? "/my-team" : leagueDashboard;
  if (requireMember && !activeLeague?.memberIds?.includes(userId)) return { status: ROUTE_ACCESS.REDIRECT, redirectTo: "/league", reason: "missing-membership" };
  if (commissionerOnly && activeLeague?.commissionerUid !== userId) return { status: ROUTE_ACCESS.REDIRECT, redirectTo: phaseDestination, reason: "commissioner-only" };
  if (allowedStatuses && !allowedStatuses.includes(activeLeague?.status)) {
    return { status: ROUTE_ACCESS.REDIRECT, redirectTo: phaseDestination, reason: pathname === "/league/draft" && activeLeague?.status === LEAGUE_STATUS.SEASON_READY ? "draft-completed" : "invalid-phase" };
  }
  return { status: ROUTE_ACCESS.ALLOWED, redirectTo: null };
}
