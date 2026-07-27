import { getTeamOverall } from './team'

const randomInt = (max) => Math.floor(Math.random() * max)
const choose = (players) => players[randomInt(players.length)]
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function getPlayerRatings(player) {
  const { overall, stats } = player
  return {
    overall,
    shooting: clamp(Math.round(overall * 0.67 + stats.points * 1.1), 65, 99),
    defense: clamp(Math.round(overall * 0.62 + stats.rebounds * 1.35 + (player.position === 'C' ? 5 : 0)), 62, 99),
    clutch: clamp(Math.round(overall * 0.78 + stats.points * 0.42), 65, 99),
    stamina: clamp(Math.round(74 + overall * 0.2 + stats.assists * 0.7), 70, 99),
  }
}

const blankStats = (players) => Object.fromEntries(players.map((player) => [player.id, { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threesMade: 0, threesAttempted: 0 }]))
const blankTeamStats = () => ({ fieldGoalsMade: 0, fieldGoalsAttempted: 0, threesMade: 0, threesAttempted: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0 })

export function createLiveGame(home, away) {
  return {
    clock: 180,
    possession: 0,
    homeScore: 0,
    awayScore: 0,
    events: [{ id: 0, clock: '03:00', type: 'tip', phase: 'early', text: 'Opening tip: the live match is underway.', homeScore: 0, awayScore: 0 }],
    homeStats: blankStats(home),
    awayStats: blankStats(away),
    homeTeamStats: blankTeamStats(),
    awayTeamStats: blankTeamStats(),
    completed: false,
    mvp: null,
  }
}

export function formatClock(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function simulatePossession(game, home, away) {
  const next = JSON.parse(JSON.stringify(game))
  if (next.completed) return next
  const isHome = next.possession % 2 === 0
  const offense = isHome ? home : away
  const defense = isHome ? away : home
  const scoreKey = isHome ? 'homeScore' : 'awayScore'
  const playerStats = isHome ? next.homeStats : next.awayStats
  const opponentStats = isHome ? next.awayStats : next.homeStats
  const teamStats = isHome ? next.homeTeamStats : next.awayTeamStats
  const opponentTeamStats = isHome ? next.awayTeamStats : next.homeTeamStats
  const shooter = choose(offense)
  const defender = choose(defense)
  const shooterRatings = getPlayerRatings(shooter)
  const defenderRatings = getPlayerRatings(defender)
  const clutchFactor = next.clock <= 45 ? (shooterRatings.clutch - defenderRatings.clutch) / 420 : 0
  const staminaPenalty = Math.max(0, next.possession - 30) * (100 - shooterRatings.stamina) / 25000
  const phase = next.clock > 120 ? 'early' : next.clock > 45 ? 'mid' : 'clutch'
  let type = 'miss'
  let text = ''

  const turnoverChance = clamp(0.085 + (defenderRatings.defense - shooterRatings.overall) / 500, 0.05, 0.16)
  if (Math.random() < turnoverChance) {
    const steal = Math.random() < 0.63
    playerStats[shooter.id].turnovers += 1
    teamStats.turnovers += 1
    if (steal) { opponentStats[defender.id].steals += 1; opponentTeamStats.steals += 1; type = 'steal'; text = `${defender.name} strips ${shooter.name} for the steal.` } else { type = 'turnover'; text = `${shooter.name} loses the handle. Turnover.` }
  } else {
    const isThree = Math.random() < 0.34
    const shotLabel = isThree ? 'three-pointer' : 'jumper'
    const makeChance = clamp(0.39 + (shooterRatings.shooting - defenderRatings.defense) / 240 + clutchFactor - staminaPenalty + (isThree ? -0.07 : 0), 0.25, 0.67)
    const blockChance = clamp(0.035 + (defenderRatings.defense - shooterRatings.shooting) / 700, 0.02, 0.12)
    playerStats[shooter.id].fieldGoalsAttempted += 1
    teamStats.fieldGoalsAttempted += 1
    if (isThree) { playerStats[shooter.id].threesAttempted += 1; teamStats.threesAttempted += 1 }
    if (Math.random() < makeChance) {
      const points = isThree ? 3 : 2
      next[scoreKey] += points
      playerStats[shooter.id].points += points
      playerStats[shooter.id].fieldGoalsMade += 1
      teamStats.fieldGoalsMade += 1
      if (isThree) { playerStats[shooter.id].threesMade += 1; teamStats.threesMade += 1 }
      const assister = offense.find((player) => player.id !== shooter.id) && Math.random() < 0.62 ? choose(offense.filter((player) => player.id !== shooter.id)) : null
      if (assister) { playerStats[assister.id].assists += 1; teamStats.assists += 1; text = `${shooter.name} drills a ${shotLabel} off a dime from ${assister.name}.` } else text = `${shooter.name} knocks down the ${shotLabel}.`
      type = isThree ? 'three' : 'made'
    } else if (Math.random() < blockChance) {
      opponentStats[defender.id].blocks += 1
      opponentTeamStats.blocks += 1
      type = 'block'
      text = `${defender.name} swats ${shooter.name}'s ${shotLabel}.`
    } else {
      const rebounder = Math.random() < 0.72 ? choose(defense) : choose(offense)
      const reboundStats = defense.some((player) => player.id === rebounder.id) ? opponentStats : playerStats
      const reboundTeamStats = defense.some((player) => player.id === rebounder.id) ? opponentTeamStats : teamStats
      reboundStats[rebounder.id].rebounds += 1
      reboundTeamStats.rebounds += 1
      type = 'miss'
      text = `${shooter.name} misses the ${shotLabel}; ${rebounder.name} secures the rebound.`
    }
  }

  next.possession += 1
  next.clock = Math.max(0, 180 - next.possession * 4)
  next.events = [...next.events.slice(-29), { id: next.possession, clock: formatClock(next.clock), type, phase, text, homeScore: next.homeScore, awayScore: next.awayScore }]
  if (next.possession >= 45) finishGame(next, home, away)
  return next
}

function finishGame(game, home, away) {
  if (game.homeScore === game.awayScore) {
    const homeWinsTiebreak = getTeamOverall(home) >= getTeamOverall(away)
    const scoreKey = homeWinsTiebreak ? 'homeScore' : 'awayScore'
    game[scoreKey] += 1
    game.events.push({ id: 'final', clock: '00:00', type: 'clutch', phase: 'clutch', text: `${homeWinsTiebreak ? 'Home' : 'Away'} converts the game-winning free throw at the buzzer.`, homeScore: game.homeScore, awayScore: game.awayScore })
  }
  const allPlayers = [...home, ...away]
  const stats = { ...game.homeStats, ...game.awayStats }
  game.mvp = allPlayers.map((player) => ({ player, stats: stats[player.id] })).sort((a, b) => (b.stats.points * 1.2 + b.stats.rebounds + b.stats.assists * 1.5 + b.stats.steals * 2 + b.stats.blocks * 2) - (a.stats.points * 1.2 + a.stats.rebounds + a.stats.assists * 1.5 + a.stats.steals * 2 + a.stats.blocks * 2))[0]?.player || null
  game.clock = 0
  game.completed = true
  game.events.push({ id: 'complete', clock: '00:00', type: 'final', phase: 'clutch', text: 'Final buzzer. The match is complete.', homeScore: game.homeScore, awayScore: game.awayScore })
}
