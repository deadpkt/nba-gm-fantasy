export const LEAGUE_STATUS = Object.freeze({
  LOBBY: "lobby",
  DRAFTING: "drafting",
  SEASON_READY: "season_ready",
  REGULAR_SEASON: "regular_season",
  PLAYOFFS: "playoffs",
  OFFSEASON: "offseason",
  FINISHED: "finished",
  CANCELLED: "cancelled",
  ARCHIVED: "archived",
});

export const LEAGUE_STATUSES = Object.freeze(Object.values(LEAGUE_STATUS));

const PHASE_LABELS = Object.freeze({
  [LEAGUE_STATUS.LOBBY]: "LOBBY",
  [LEAGUE_STATUS.DRAFTING]: "DRAFT",
  [LEAGUE_STATUS.SEASON_READY]: "TEAM SETUP",
  [LEAGUE_STATUS.REGULAR_SEASON]: "REGULAR SEASON",
  [LEAGUE_STATUS.PLAYOFFS]: "PLAYOFFS",
  [LEAGUE_STATUS.OFFSEASON]: "OFFSEASON",
  [LEAGUE_STATUS.FINISHED]: "FINISHED",
  [LEAGUE_STATUS.CANCELLED]: "CANCELLED",
  [LEAGUE_STATUS.ARCHIVED]: "ARCHIVED",
});

export function getLeagueStatusLabel(status) {
  return LEAGUE_STATUSES.includes(status) ? PHASE_LABELS[status] : "UNKNOWN";
}
