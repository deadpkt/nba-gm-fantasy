import {
  createLiveGame,
  simulatePossession,
} from "../shared/liveSimulation.js";
import { OFFICIAL_PRESENTATION_DURATION_MS } from "../shared/presentationTiming.js";
import { validateStartingLineup } from "../shared/lineup.js";
import { EVENT_SCHEMA_VERSION_V1, SIMULATION_VERSION_V1, SIMULATION_VERSION_V2, validateSimulationVersionPins } from "../shared/engineVersions.js";
import { simulateOfficialGameV2 } from "../shared/officialSimulationV2.js";

export { OFFICIAL_PRESENTATION_DURATION_MS } from "../shared/presentationTiming.js";
const TRACKED_STATS = ["points", "rebounds", "assists", "steals", "blocks"];

export function createOfficialGameSeed({
  leagueId,
  season,
  scheduleVersion,
  gameId,
  homeUid,
  awayUid,
}) {
  return [leagueId, season, scheduleVersion, gameId, homeUid, awayUid].join("|");
}

export function createSeededRandom(seed) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getValidStartingLineup(team, expectedRosterSize = 5) {
  const validation = validateStartingLineup(team, expectedRosterSize);
  if (!validation.valid) throw new Error("Both franchises need a complete, position-eligible five-player lineup.");
  return validation.players;
}

const playerBoxScore = (players, stats) =>
  players.map((player) => ({
    playerId: player.id,
    name: player.name,
    position: player.position,
    stats: stats[player.id],
  }));

function statDeltas(before, after, side) {
  return Object.entries(after).flatMap(([playerId, stats]) => {
    const delta = Object.fromEntries(
      TRACKED_STATS.map((key) => [key, stats[key] - (before[playerId]?.[key] || 0)]),
    );
    return Object.values(delta).some(Boolean)
      ? [{ playerId, side, ...delta }]
      : [];
  });
}

const quarterForPossession = (possession) =>
  possession <= 12 ? 1 : possession <= 23 ? 2 : possession <= 34 ? 3 : 4;

function quarterClock(possession, quarter) {
  const starts = [0, 0, 12, 23, 34];
  const counts = [0, 12, 11, 11, 11];
  const position = possession - starts[quarter];
  const seconds = Math.max(0, Math.round(720 * (1 - position / counts[quarter])));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function buildTimeline(possessions, gameIdentity, finalScore) {
  const timeline = [];
  const quarterEnds = new Set([12, 23, 34, 45]);
  const push = (event) => timeline.push({ sequence: timeline.length + 1, ...event });

  possessions.forEach((event) => {
    push(event);
    if (event.possession === 45 && (event.homeScore !== finalScore.homeScore || event.awayScore !== finalScore.awayScore)) {
      const homeScored = finalScore.homeScore > event.homeScore;
      push({
        quarter: 4,
        gameClock: "00:00",
        offenseUid: homeScored ? gameIdentity.homeUid : gameIdentity.awayUid,
        defenseUid: homeScored ? gameIdentity.awayUid : gameIdentity.homeUid,
        playerId: null,
        eventType: "free_throw",
        pointsScored: 1,
        homeScore: finalScore.homeScore,
        awayScore: finalScore.awayScore,
        text: `${homeScored ? "Home" : "Away"} converts the game-winning free throw.`,
        statDeltas: [],
      });
    }
    if (quarterEnds.has(event.possession)) {
      push({
        quarter: event.quarter,
        gameClock: "00:00",
        eventType: "quarter_end",
        pointsScored: 0,
        homeScore: event.possession === 45 ? finalScore.homeScore : event.homeScore,
        awayScore: event.possession === 45 ? finalScore.awayScore : event.awayScore,
        text: `End of Q${event.quarter}.`,
        statDeltas: [],
      });
      if (event.quarter === 2) {
        push({
          quarter: 2,
          gameClock: "00:00",
          eventType: "halftime",
          pointsScored: 0,
          homeScore: event.homeScore,
          awayScore: event.awayScore,
          text: "Halftime.",
          statDeltas: [],
        });
      }
    }
  });
  push({
    quarter: 4,
    gameClock: "00:00",
    eventType: "game_end",
    pointsScored: 0,
    homeScore: finalScore.homeScore,
    awayScore: finalScore.awayScore,
    text: "Final buzzer. The official game is complete.",
    statDeltas: [],
  });
  const interval = OFFICIAL_PRESENTATION_DURATION_MS / (timeline.length - 1);
  return timeline.map((event, index) => ({
    ...event,
    presentationOffsetMs: Math.round(index * interval),
  }));
}

export function simulateOfficialGameV1({ gameIdentity, homeTeam, awayTeam, rosterSize = 5 }) {
  const home = getValidStartingLineup(homeTeam, rosterSize);
  const away = getValidStartingLineup(awayTeam, rosterSize);
  const seed = createOfficialGameSeed(gameIdentity);
  const random = createSeededRandom(seed);
  let simulation = createLiveGame(home, away);
  const possessions = [];
  while (!simulation.completed) {
    const before = simulation;
    simulation = simulatePossession(simulation, home, away, random);
    const possession = simulation.possession;
    const sourceEvent = simulation.events.find((event) => event.id === possession);
    const quarter = quarterForPossession(possession);
    const homeOffense = possession % 2 === 1;
    possessions.push({
      possession,
      quarter,
      gameClock: quarterClock(possession, quarter),
      offenseUid: homeOffense ? gameIdentity.homeUid : gameIdentity.awayUid,
      defenseUid: homeOffense ? gameIdentity.awayUid : gameIdentity.homeUid,
      playerId: sourceEvent.offensePlayerId,
      defensePlayerId: sourceEvent.defensePlayerId,
      eventType: sourceEvent.eventType,
      pointsScored: sourceEvent.pointsScored,
      assistPlayerId: sourceEvent.assistPlayerId,
      reboundPlayerId: sourceEvent.reboundPlayerId,
      defensivePlayerId: sourceEvent.defensivePlayerId,
      homeScore: sourceEvent.homeScore,
      awayScore: sourceEvent.awayScore,
      text: sourceEvent.text,
      statDeltas: [
        ...statDeltas(before.homeStats, simulation.homeStats, "home"),
        ...statDeltas(before.awayStats, simulation.awayStats, "away"),
      ],
    });
  }

  const homeWon = simulation.homeScore > simulation.awayScore;
  const result = {
    homeScore: simulation.homeScore,
    awayScore: simulation.awayScore,
    winnerUid: homeWon ? gameIdentity.homeUid : gameIdentity.awayUid,
    loserUid: homeWon ? gameIdentity.awayUid : gameIdentity.homeUid,
  };
  return {
    result,
    timeline: buildTimeline(possessions, gameIdentity, result),
    boxScore: {
      version: 1,
      seedVersion: 1,
      home: {
        uid: gameIdentity.homeUid,
        teamName: homeTeam.name,
        strategy: homeTeam.strategy || "balanced",
        teamStats: simulation.homeTeamStats,
        players: playerBoxScore(home, simulation.homeStats),
      },
      away: {
        uid: gameIdentity.awayUid,
        teamName: awayTeam.name,
        strategy: awayTeam.strategy || "balanced",
        teamStats: simulation.awayTeamStats,
        players: playerBoxScore(away, simulation.awayStats),
      },
      mvpPlayerId: simulation.mvp?.id ?? null,
    },
  };
}

export function simulateOfficialGame({ gameIdentity, homeTeam, awayTeam, rosterSize = 5, simulationVersion = SIMULATION_VERSION_V1 }) {
  if (simulationVersion === SIMULATION_VERSION_V1) return simulateOfficialGameV1({ gameIdentity, homeTeam, awayTeam, rosterSize });
  if (simulationVersion !== SIMULATION_VERSION_V2) throw new Error("This simulation version is not supported.");
  const assigned = (players) => players.map((player, index) => ({ ...player, assignedPosition: ["PG", "SG", "SF", "PF", "C"][index] }));
  const homePlayers = assigned(getValidStartingLineup(homeTeam, rosterSize));
  const awayPlayers = assigned(getValidStartingLineup(awayTeam, rosterSize));
  const seed = createOfficialGameSeed(gameIdentity);
  return simulateOfficialGameV2({ seed, gameIdentity, homeTeam, awayTeam, homePlayers, awayPlayers });
}

const normalizedRecord = (team) => ({
  wins: Number.isInteger(team?.record?.wins) ? team.record.wins : 0,
  losses: Number.isInteger(team?.record?.losses) ? team.record.losses : 0,
});

export function buildOfficialCompletion({ game, homeTeam, awayTeam, simulation }) {
  if (game.status === "completed") {
    return {
      alreadyCompleted: true,
      result: game.result,
      boxScore: game.boxScore,
      timeline: game.timeline,
      presentation: game.presentation,
    };
  }
  if (game.status !== "in_progress") {
    throw new Error("Only an in-progress official game can be completed.");
  }

  const homeRecord = normalizedRecord(homeTeam);
  const awayRecord = normalizedRecord(awayTeam);
  const homeWon = simulation.result.winnerUid === game.homeUid;
  return {
    alreadyCompleted: false,
    result: simulation.result,
    boxScore: simulation.boxScore,
    timeline: simulation.timeline,
    homeRecord: {
      wins: homeRecord.wins + (homeWon ? 1 : 0),
      losses: homeRecord.losses + (homeWon ? 0 : 1),
    },
    awayRecord: {
      wins: awayRecord.wins + (homeWon ? 0 : 1),
      losses: awayRecord.losses + (homeWon ? 1 : 0),
    },
  };
}

export function buildOfficialGameActivation({ game, homeTeam, awayTeam, startedAt, endsAt, rosterSize = 5, league = {} }) {
  if (!["scheduled", "ready"].includes(game?.status)) {
    throw new Error("Only a scheduled official game can be activated.");
  }
  const engineVersions = validateSimulationVersionPins(league.seasonEngineVersions ? { engineVersions: league.seasonEngineVersions } : {});
  const simulation = simulateOfficialGame({
    gameIdentity: {
      leagueId: game.leagueId,
      gameId: game.id,
      season: game.season,
      scheduleVersion: game.scheduleVersion,
      homeUid: game.homeUid,
      awayUid: game.awayUid,
    },
    homeTeam,
    awayTeam,
    rosterSize,
    simulationVersion: engineVersions.simulationVersion,
  });
  return {
    status: "in_progress",
    simulationVersion: engineVersions.simulationVersion,
    ratingsVersion: engineVersions.ratingsVersion,
    eventSchemaVersion: engineVersions.eventSchemaVersion,
    runtime: { version: engineVersions.simulationVersion },
    startedAt,
    result: simulation.result,
    boxScore: simulation.boxScore,
    timeline: simulation.timeline,
    ...(simulation.simulationInput ? { simulationInput: simulation.simulationInput } : {}),
    ...(simulation.simulationInput?.seed ? { simulationSeed: simulation.simulationInput.seed } : {}),
    presentation: {
      version: engineVersions.eventSchemaVersion === EVENT_SCHEMA_VERSION_V1 ? 1 : 2,
      speed: 1,
      durationMs: OFFICIAL_PRESENTATION_DURATION_MS,
      startedAt,
      endsAt,
    },
    resultGeneratedAt: startedAt,
    updatedAt: startedAt,
  };
}

export function isOfficialLeagueGamePath(path) {
  return /^leagues\/[^/]+\/games\/[^/]+$/.test(path);
}
