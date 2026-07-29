export const LEAGUE_STATUS = Object.freeze({
  LOBBY: "lobby",
  DRAFTING: "drafting",
  SEASON_READY: "season_ready",
  REGULAR_SEASON: "regular_season",
  PLAYOFFS: "playoffs",
  OFFSEASON: "offseason",
  FINISHED: "finished",
  CANCELLED: "cancelled",
});

export const LEAGUE_STATUSES = Object.freeze(Object.values(LEAGUE_STATUS));

export function getLeagueStatusLabel(status) {
  return LEAGUE_STATUSES.includes(status)
    ? status.replaceAll("_", " ").toUpperCase()
    : "UNKNOWN";
}
