import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";

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

  if (activeLeagueId && leagueLoading) {
    return <div className="route-loader">Loading league access...</div>;
  }

  if (requireActive && (!activeLeagueId || !activeLeague)) {
    return (
      <Navigate
        to="/league"
        replace
        state={{
          from: location,
          leagueAccessMessage: "Create or join a league before opening that page.",
        }}
      />
    );
  }

  const isMember = Boolean(activeLeague?.memberIds?.includes(user.uid));
  if (requireMember && !isMember) {
    return (
      <Navigate
        to="/league"
        replace
        state={{
          from: location,
          leagueAccessMessage: "Your active league membership is required for that page.",
        }}
      />
    );
  }

  const leagueDashboard = activeLeagueId ? `/league/${activeLeagueId}` : "/league";
  const phaseDestination =
    activeLeague?.status === LEAGUE_STATUS.SEASON_READY
      ? "/my-team"
      : leagueDashboard;
  if (commissionerOnly && activeLeague?.commissionerUid !== user.uid) {
    return (
      <Navigate
        to={phaseDestination}
        replace
        state={{
          from: location,
          leagueAccessMessage: "Only the league commissioner can open that page.",
        }}
      />
    );
  }

  if (allowedStatuses && !allowedStatuses.includes(activeLeague?.status)) {
    const draftJustCompleted =
      location.pathname === "/league/draft" &&
      activeLeague?.status === LEAGUE_STATUS.SEASON_READY;
    return (
      <Navigate
        to={phaseDestination}
        replace
        state={{
          from: location,
          leagueAccessMessage: draftJustCompleted
            ? "Draft Complete — Set Your Starting Lineup."
            : `That page is locked while the league is in the ${activeLeague?.status || "unavailable"} phase.`,
        }}
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
  return <LeagueRouteGuard allowedStatuses={statuses}>{children}</LeagueRouteGuard>;
}

export default LeagueRouteGuard;
