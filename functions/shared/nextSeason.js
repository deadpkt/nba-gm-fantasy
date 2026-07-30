import { validateStartingLineup } from "./lineup.js";
import { normalizeRosterConfig } from "./rosterConfig.js";

function validTeam(team, uid, league) {
  return (team?.ownerUid || team?.id) === uid && validateStartingLineup(team, normalizeRosterConfig(league).rosterSize).valid;
}

export const NEXT_SEASON_FIELDS_TO_CLEAR = Object.freeze(["regularSeasonResult", "postseason", "seasonProgress", "schedule", "seasonStartedAt", "offseason"]);

export function isNextSeasonCommissioner(league, uid) {
  return typeof uid === "string" && league?.commissionerUid === uid;
}

export function buildNextSeasonTransition({ league, history, teams, transitionedAt }) {
  if (league?.status !== "offseason") throw new Error("The league is not in offseason.");
  if (!Number.isInteger(league.season) || league.season < 1) throw new Error("The current season is invalid.");
  const targetSeason = league.season + 1;
  const offseason = league.offseason;
  if (!offseason || offseason.status !== "open" || offseason.seasonCompleted !== league.season || offseason.nextSeason !== targetSeason) throw new Error("The offseason does not target the next season.");
  if (history?.season !== league.season || history.status !== "completed") throw new Error("The completed-season history is unavailable.");
  const members = Array.isArray(league.memberIds) ? league.memberIds : [];
  const readyIds = Array.isArray(offseason.readyMemberIds) ? offseason.readyMemberIds : [];
  if (members.length !== league.maxMembers || readyIds.length !== members.length || !members.every((uid) => readyIds.includes(uid))) throw new Error("Every current franchise must confirm readiness for the next season.");
  const teamMap = new Map(teams.map((team) => [team.id || team.ownerUid, team]));
  if (teamMap.size !== members.length || members.some((uid) => !validTeam(teamMap.get(uid), uid, league))) throw new Error("Every franchise needs a complete configured roster and valid Starting Five.");
  return {
    targetSeason,
    leagueUpdate: {
      season: targetSeason,
      status: "season_ready",
      seasonReadyMemberIds: [...members],
      seasonTransition: { fromSeason: league.season, targetSeason, offseasonStartedAt: offseason.startedAt, completedAt: transitionedAt },
      updatedAt: transitionedAt,
    },
    teamUpdates: members.map((uid) => ({ uid, record: { wins: 0, losses: 0 }, updatedAt: transitionedAt })),
    fieldsToClear: [...NEXT_SEASON_FIELDS_TO_CLEAR],
  };
}

export function isNextSeasonTransitionRetry(league) {
  return league?.status === "season_ready" && league.seasonTransition?.targetSeason === league.season && league.seasonTransition?.fromSeason === league.season - 1;
}
