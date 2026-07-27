import { getTeamOverall } from './team'

const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

function createTeamStats(team, score) {
  return {
    score,
    fieldGoal: `${randomNumber(42, 58)}%`,
    rebounds: randomNumber(38, 55),
    assists: randomNumber(19, 34),
    turnovers: randomNumber(7, 16),
    overall: getTeamOverall(team),
  }
}

export function simulateGame(homeTeam, awayTeam) {
  const homeOverall = getTeamOverall(homeTeam)
  const awayOverall = getTeamOverall(awayTeam)
  const homeScore = Math.round(88 + homeOverall * 0.42 + randomNumber(-12, 12) + 3)
  let awayScore = Math.round(88 + awayOverall * 0.42 + randomNumber(-12, 12))

  if (homeScore === awayScore) awayScore += randomNumber(1, 7)

  const homeWon = homeScore > awayScore
  const mvpPool = homeWon ? homeTeam : awayTeam
  const mvp = [...mvpPool].sort((a, b) => b.overall - a.overall)[randomNumber(0, Math.min(2, mvpPool.length - 1))]

  return {
    home: createTeamStats(homeTeam, homeScore),
    away: createTeamStats(awayTeam, awayScore),
    homeWon,
    mvp,
  }
}
