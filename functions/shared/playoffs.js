export const PLAYOFF_VERSION = 1;

export function playoffGameId(season, key) {
  return `s${String(season).padStart(3, "0")}-p${String(PLAYOFF_VERSION).padStart(2, "0")}-${key}`;
}

function validateQualifiers(league) {
  const qualifiers = league?.postseason?.qualifiers || [];
  if (![2, 4].includes(qualifiers.length)) throw new Error("The frozen playoff field must contain two or four teams.");
  const seeds = new Set(qualifiers.map((team) => team.seed));
  const uids = new Set(qualifiers.map((team) => team.uid));
  if (seeds.size !== qualifiers.length || uids.size !== qualifiers.length) throw new Error("Playoff seeds and franchises must be unique.");
  if (!qualifiers.every((team, index) => team.seed === index + 1 && league.memberIds.includes(team.uid))) {
    throw new Error("The frozen playoff field is invalid.");
  }
  return qualifiers;
}

function matchup(league, key, stage, home, away, sourceGameIds = []) {
  return {
    id: playoffGameId(league.season, key), leagueId: league.id, season: league.season,
    scheduleVersion: league.seasonConfig.scheduleVersion, playoffVersion: PLAYOFF_VERSION,
    playoffGameKey: key, stage, homeUid: home.uid, awayUid: away.uid,
    homeTeamName: home.teamName, awayTeamName: away.teamName,
    homeSeed: home.seed, awaySeed: away.seed, sourceGameIds, status: "scheduled",
  };
}

export function buildPlayoffInitialization(league) {
  if (league.status === "playoffs" && league.postseason?.bracketVersion === PLAYOFF_VERSION) {
    return { alreadyInitialized: true, postseason: league.postseason, games: [] };
  }
  if (league.status !== "regular_season" || !league.regularSeasonResult || league.postseason?.status !== "ready") {
    throw new Error("The finalized regular season is not ready for playoff initialization.");
  }
  const qualifiers = validateQualifiers(league);
  const games = qualifiers.length === 2
    ? [matchup(league, "final", "final", qualifiers[0], qualifiers[1])]
    : [matchup(league, "sf1", "semifinal", qualifiers[0], qualifiers[3]), matchup(league, "sf2", "semifinal", qualifiers[1], qualifiers[2])];
  return {
    alreadyInitialized: false,
    games,
    postseason: {
      ...league.postseason,
      status: qualifiers.length === 2 ? "finals" : "semifinals",
      bracketVersion: PLAYOFF_VERSION,
      games: { semifinals: games.filter((game) => game.stage === "semifinal").map((game) => game.id), final: games.find((game) => game.stage === "final")?.id || null },
    },
  };
}

export function buildFinalMatchup(league, semifinalGames) {
  const qualifiers = validateQualifiers(league);
  if (semifinalGames.length !== 2 || semifinalGames.some((game) => game.stage !== "semifinal" || game.status !== "completed" || !game.result?.winnerUid)) {
    throw new Error("Both trusted semifinals must be completed.");
  }
  const winners = semifinalGames.map((game) => qualifiers.find((team) => team.uid === game.result.winnerUid));
  if (winners.some((team) => !team)) throw new Error("A semifinal winner is outside the frozen playoff field.");
  winners.sort((a, b) => a.seed - b.seed);
  return matchup(league, "final", "final", winners[0], winners[1], semifinalGames.map((game) => game.id).sort());
}

export function buildChampionship(postseason, finalGame, completedAt) {
  if (postseason?.status === "completed" && postseason.champion) return { alreadyCompleted: true, postseason };
  if (finalGame?.stage !== "final" || finalGame.status !== "completed" || !finalGame.result?.winnerUid) throw new Error("A trusted completed Final is required.");
  const winner = postseason.qualifiers.find((team) => team.uid === finalGame.result.winnerUid);
  const loser = postseason.qualifiers.find((team) => team.uid === finalGame.result.loserUid);
  if (!winner || !loser) throw new Error("The championship result does not match the frozen field.");
  return { alreadyCompleted: false, postseason: { ...postseason, status: "completed", champion: winner, runnerUp: loser, completedAt } };
}
