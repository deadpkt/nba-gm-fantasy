function playoffSummary(game) {
  if (!["semifinal", "final"].includes(game?.stage) || game.status !== "completed" || !game.result) {
    throw new Error("Every historical playoff game must have a trusted completed result.");
  }
  return {
    gameId: game.id,
    stage: game.stage,
    home: { uid: game.homeUid, teamName: game.homeTeamName, seed: game.homeSeed, score: game.result.homeScore },
    away: { uid: game.awayUid, teamName: game.awayTeamName, seed: game.awaySeed, score: game.result.awayScore },
    winnerUid: game.result.winnerUid,
    loserUid: game.result.loserUid,
  };
}

function comparable(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, comparable(value[key])]));
  return value;
}

export function seasonHistoryMatches(existing, expected) {
  const existingSnapshot = { ...existing };
  const expectedSnapshot = { ...expected };
  delete existingSnapshot.createdAt;
  delete expectedSnapshot.createdAt;
  return JSON.stringify(comparable(existingSnapshot)) === JSON.stringify(comparable(expectedSnapshot));
}

export function buildSeasonHistory({ league, playoffGames }) {
  if (league?.status !== "playoffs") throw new Error("The league is not in the playoffs.");
  const postseason = league.postseason;
  if (postseason?.status !== "completed" || !postseason.champion || !postseason.runnerUp) throw new Error("The trusted championship is not complete.");
  if (league.regularSeasonResult?.season !== league.season || !Array.isArray(league.regularSeasonResult.standings)) throw new Error("The frozen regular-season result is unavailable.");
  if (!Array.isArray(postseason.qualifiers) || playoffGames.some((game) => game.season !== league.season || game.leagueId !== league.id)) throw new Error("The playoff history does not belong to the completed season.");
  const summaries = playoffGames.map(playoffSummary).sort((a, b) => a.stage === b.stage ? a.gameId.localeCompare(b.gameId) : a.stage === "semifinal" ? -1 : 1);
  const final = summaries.find((game) => game.stage === "final");
  if (!final || final.winnerUid !== postseason.champion.uid || final.loserUid !== postseason.runnerUp.uid) throw new Error("The trusted Final does not match the champion and runner-up.");
  return {
    season: league.season,
    status: "completed",
    leagueSize: league.maxMembers,
    seasonConfig: { ...league.seasonConfig },
    champion: { ...postseason.champion },
    runnerUp: { ...postseason.runnerUp },
    regularSeason: { standings: league.regularSeasonResult.standings.map((row) => ({ ...row })) },
    playoffs: {
      qualifiers: postseason.qualifiers.map((team) => ({ ...team })),
      bracketVersion: postseason.bracketVersion,
      games: summaries,
    },
    completedAt: postseason.completedAt,
  };
}

export function buildOffseasonTransition(league, startedAt) {
  if (league?.status !== "playoffs" || league.postseason?.status !== "completed") throw new Error("Only a completed playoff season can enter offseason.");
  return {
    status: "offseason",
    offseason: { seasonCompleted: league.season, nextSeason: league.season + 1, status: "open", preparationVersion: 1, readyMemberIds: [], startedAt },
    updatedAt: startedAt,
  };
}
