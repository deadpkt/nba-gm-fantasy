import { calculateStandings, isValidCompletedSeasonGame } from "./standings.js";

export const STANDINGS_VERSION = 1;
export const PLAYOFF_QUALIFIER_COUNTS = Object.freeze({ 2: 2, 4: 4, 6: 4, 8: 4 });

export function playoffQualifierCount(leagueSize) {
  const count = PLAYOFF_QUALIFIER_COUNTS[leagueSize];
  if (!count) throw new Error("Playoff qualification supports 2, 4, 6, or 8 teams.");
  return count;
}

export function buildRegularSeasonFinalization({ league, teams, games, completedAt }) {
  if (league?.status !== "regular_season") throw new Error("The league is not in the regular season.");
  if (league.seasonProgress?.regularSeasonComplete !== true) throw new Error("The regular season completion flag is not set.");
  if (league.regularSeasonResult) {
    if (league.regularSeasonResult.season !== league.season) throw new Error("A conflicting regular-season snapshot already exists.");
    return { alreadyFinalized: true, regularSeasonResult: league.regularSeasonResult, postseason: league.postseason };
  }

  const memberIds = Array.isArray(league.memberIds) ? league.memberIds.map(String) : [];
  const teamUids = new Set(teams.map((team) => String(team.ownerUid || team.uid || team.id)));
  if (memberIds.length !== league.maxMembers || teamUids.size !== memberIds.length || !memberIds.every((uid) => teamUids.has(uid))) {
    throw new Error("Every league franchise must exist before finalization.");
  }
  const seasonGames = games.filter((game) => game.season === league.season);
  if (!Number.isInteger(league.schedule?.totalGames) || seasonGames.length !== league.schedule.totalGames) {
    throw new Error("The active-season schedule is incomplete.");
  }
  if (seasonGames.some((game) => !isValidCompletedSeasonGame(game, league.season, teamUids))) {
    throw new Error("Every active-season game must have a valid completed result.");
  }

  const standings = calculateStandings(teams, seasonGames, league.season);
  if (standings.length !== memberIds.length || standings.some((row) => row.gp !== league.seasonConfig?.gamesPerTeam)) {
    throw new Error("The final standings do not match the configured season schedule.");
  }
  const finalRows = standings.map((row) => ({
    seed: row.rank, uid: row.teamUid, teamName: row.teamName,
    gp: row.gp, wins: row.wins, losses: row.losses, winPct: row.winPercentage,
    pointsFor: row.pointsFor, pointsAgainst: row.pointsAgainst,
    differential: row.pointDifferential,
  }));
  const qualifierCount = playoffQualifierCount(memberIds.length);
  const qualifiers = finalRows.slice(0, qualifierCount)
    .map(({ seed, uid, teamName }) => ({ seed, uid, teamName }));
  return {
    alreadyFinalized: false,
    regularSeasonResult: {
      season: league.season,
      completedAt,
      standingsVersion: STANDINGS_VERSION,
      standings: finalRows,
    },
    postseason: {
      status: "ready",
      season: league.season,
      qualifierCount,
      qualifiers,
      createdAt: completedAt,
    },
  };
}
