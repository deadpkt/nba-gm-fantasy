import { LEAGUE_STATUS } from "./leagueStatuses.js";

export function getHeaderNavigation(activeLeagueId, status) {
  if (!activeLeagueId || [LEAGUE_STATUS.CANCELLED, LEAGUE_STATUS.ARCHIVED].includes(status)) return [];
  if (status === LEAGUE_STATUS.LOBBY) return [];
  if (status === LEAGUE_STATUS.DRAFTING) return [{ to: "/league/draft", label: "Draft", icon: "clipboard" }];
  if (status === LEAGUE_STATUS.SEASON_READY) return [{ to: "/my-team", label: "My Team", icon: "team" }];
  if (status === LEAGUE_STATUS.REGULAR_SEASON) return [{ to: "/my-team", label: "My Team", icon: "team" }, { to: "/games", label: "Games", icon: "games" }, { to: "/standings", label: "Standings", icon: "standings" }];
  if (status === LEAGUE_STATUS.PLAYOFFS) return [{ to: "/my-team", label: "My Team", icon: "team" }, { to: "/standings", label: "Standings", icon: "standings" }, { to: "/playoffs", label: "Playoffs", icon: "playoffs" }];
  if (status === LEAGUE_STATUS.OFFSEASON) return [{ to: "/my-team", label: "My Team", icon: "team" }, { to: "/free-agency", label: "Free Agency", icon: "freeAgency" }, { to: "/contracts", label: "Contracts", icon: "clipboard" }];
  return [];
}

export function getPrimaryNavigationItems({ activeLeagueId, status, loading = false } = {}) {
  if (loading) return [];
  if (!activeLeagueId || [LEAGUE_STATUS.CANCELLED, LEAGUE_STATUS.ARCHIVED].includes(status)) return [{ to: "/league", label: "League", icon: "league" }];
  const items = [{ to: `/league/${activeLeagueId}`, label: "League", icon: "league" }, ...getHeaderNavigation(activeLeagueId, status)];
  if (status === LEAGUE_STATUS.OFFSEASON) items.push({ to: "/league/history", label: "History", icon: "history" });
  return items;
}
