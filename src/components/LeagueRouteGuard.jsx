import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { resolveLeagueRouteAccess, ROUTE_ACCESS } from "../lib/routeAccess";
import AppLoadingScreen from "./brand/AppLoadingScreen";

function LeagueRouteGuard({
  children,
  requireActive = true,
  requireMember = true,
  commissionerOnly = false,
  allowedStatuses,
}) {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, leagueLoading } = useLeague();
  const location = useLocation();
  const access = resolveLeagueRouteAccess({
    leagueLoading,
    activeLeagueId,
    activeLeague,
    userId: user?.uid,
    requireActive,
    requireMember,
    commissionerOnly,
    allowedStatuses,
    pathname: location.pathname,
  });

  if (access.status === ROUTE_ACCESS.LOADING) return <AppLoadingScreen />;
  if (access.status === ROUTE_ACCESS.REDIRECT) {
    const messages = {
      "missing-league": "Create or join a league before opening that page.",
      "missing-membership":
        "Your active league membership is required for that page.",
      "commissioner-only": "Only the league commissioner can open that page.",
      "draft-completed": "Draft Complete — Set Your Starting Lineup.",
      "invalid-phase": `That page is locked while the league is in the ${activeLeague?.status || "unavailable"} phase.`,
    };
    return (
      <Navigate
        to={access.redirectTo}
        replace
        state={{ from: location, leagueAccessMessage: messages[access.reason] }}
      />
    );
  }
  return children;
}

export function ActiveLeagueRoute({ children }) {
  return <LeagueRouteGuard requireMember={false}>{children}</LeagueRouteGuard>;
}
export function LeagueMemberRoute({ children }) {
  return <LeagueRouteGuard>{children}</LeagueRouteGuard>;
}
export function CommissionerRoute({ children }) {
  return <LeagueRouteGuard commissionerOnly>{children}</LeagueRouteGuard>;
}
export function LeaguePhaseRoute({ children, statuses }) {
  return (
    <LeagueRouteGuard allowedStatuses={statuses}>{children}</LeagueRouteGuard>
  );
}
export default LeagueRouteGuard;
