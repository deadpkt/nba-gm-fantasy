function normalizedTeam(team = {}) {
  const uid = team.ownerUid || team.uid || team.id;
  return uid ? {
    uid: String(uid),
    teamName: team.name || team.teamName || "Unnamed Franchise",
    record: team.record || { wins: 0, losses: 0 },
  } : null;
}

function gameOrder(game = {}) {
  return [
    Number.isFinite(game.scheduledOrder) ? game.scheduledOrder : Number.MAX_SAFE_INTEGER,
    Number.isFinite(game.round) ? game.round : Number.MAX_SAFE_INTEGER,
    Number.isFinite(game.gameNumber) ? game.gameNumber : Number.MAX_SAFE_INTEGER,
    String(game.id || ""),
  ];
}

function compareGameOrder(left, right) {
  const a = gameOrder(left);
  const b = gameOrder(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function isValidCompletedSeasonGame(game, season, teamUids) {
  if (
    game?.status !== "completed" || game.season !== season ||
    (game.stage != null && game.stage !== "regular_season") ||
    !teamUids.has(String(game.homeUid)) || !teamUids.has(String(game.awayUid)) ||
    game.homeUid === game.awayUid
  ) return false;
  const result = game.result;
  if (
    !Number.isFinite(result?.homeScore) || !Number.isFinite(result?.awayScore) ||
    result.homeScore < 0 || result.awayScore < 0 || result.homeScore === result.awayScore
  ) return false;
  const expectedWinner = result.homeScore > result.awayScore ? String(game.homeUid) : String(game.awayUid);
  const expectedLoser = expectedWinner === String(game.homeUid) ? String(game.awayUid) : String(game.homeUid);
  return String(result.winnerUid) === expectedWinner && String(result.loserUid) === expectedLoser;
}

export function calculateStandings(teams = [], games = [], season) {
  const normalizedTeams = teams.map(normalizedTeam).filter(Boolean);
  const rows = new Map(normalizedTeams.map((team) => [team.uid, {
    teamUid: team.uid, teamName: team.teamName, teamRecord: team.record,
    gp: 0, wins: 0, losses: 0, winPercentage: 0,
    pointsFor: 0, pointsAgainst: 0, pointDifferential: 0,
    streak: "-", outcomes: [],
  }]));
  const teamUids = new Set(rows.keys());

  games.filter((game) => isValidCompletedSeasonGame(game, season, teamUids))
    .sort(compareGameOrder)
    .forEach((game) => {
      const home = rows.get(String(game.homeUid));
      const away = rows.get(String(game.awayUid));
      const homeWon = String(game.result.winnerUid) === home.teamUid;
      home.gp += 1; away.gp += 1;
      home.wins += homeWon ? 1 : 0; home.losses += homeWon ? 0 : 1;
      away.wins += homeWon ? 0 : 1; away.losses += homeWon ? 1 : 0;
      home.pointsFor += game.result.homeScore; home.pointsAgainst += game.result.awayScore;
      away.pointsFor += game.result.awayScore; away.pointsAgainst += game.result.homeScore;
      home.outcomes.push(homeWon ? "W" : "L"); away.outcomes.push(homeWon ? "L" : "W");
    });

  const ranked = [...rows.values()].map((row) => {
    const latest = row.outcomes.at(-1);
    let streakLength = 0;
    for (let index = row.outcomes.length - 1; index >= 0 && row.outcomes[index] === latest; index -= 1) streakLength += 1;
    return {
      ...row,
      winPercentage: row.gp ? row.wins / row.gp : 0,
      pointDifferential: row.pointsFor - row.pointsAgainst,
      streak: latest ? `${latest}${streakLength}` : "-",
    };
  }).sort((left, right) =>
    right.winPercentage - left.winPercentage || right.wins - left.wins ||
    right.pointDifferential - left.pointDifferential || right.pointsFor - left.pointsFor ||
    left.teamName.localeCompare(right.teamName, undefined, { sensitivity: "base" }) ||
    left.teamUid.localeCompare(right.teamUid));

  return ranked.map(({ outcomes: _outcomes, ...row }, index) => ({ ...row, rank: index + 1 }));
}

export function findRecordMismatches(rows) {
  return rows.filter((row) => row.teamRecord?.wins !== row.wins || row.teamRecord?.losses !== row.losses)
    .map((row) => ({ teamUid: row.teamUid, stored: row.teamRecord, derived: { wins: row.wins, losses: row.losses } }));
}
