import { LEAGUE_STATUS } from "./leagueStatuses.js";

export function getHeaderNavigation(activeLeagueId, status) {
  if (!activeLeagueId || status === LEAGUE_STATUS.CANCELLED) return [];
  if (status === LEAGUE_STATUS.LOBBY) return [];
  if (status === LEAGUE_STATUS.DRAFTING) return [{ to: "/league/draft", label: "Draft" }];
  if (status === LEAGUE_STATUS.SEASON_READY) return [{ to: "/my-team", label: "My Team" }];
  if (status === LEAGUE_STATUS.REGULAR_SEASON) return [{ to: "/my-team", label: "My Team" }, { to: "/games", label: "Games" }, { to: "/standings", label: "Standings" }];
  if (status === LEAGUE_STATUS.PLAYOFFS) return [{ to: "/my-team", label: "My Team" }, { to: "/standings", label: "Standings" }, { to: "/playoffs", label: "Playoffs" }];
  if (status === LEAGUE_STATUS.OFFSEASON) return [{ to: "/my-team", label: "My Team" }, { to: "/free-agency", label: "Free Agency" }, { to: "/contracts", label: "Contracts" }];
  return [];
}
