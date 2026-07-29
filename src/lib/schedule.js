import { normalizeSeasonConfig } from "./seasonConfig.js";

export const OFFICIAL_GAME_STATUS = Object.freeze({
  SCHEDULED: "scheduled",
});

const padded = (value) => String(value).padStart(3, "0");

export function createScheduleGameId({ season, scheduleVersion, round, gameNumber }) {
  return `s${padded(season)}-v${scheduleVersion}-r${padded(round)}-g${padded(gameNumber)}`;
}

function buildRoundRobinCycle(memberIds) {
  const rotation = [...memberIds];
  const rounds = [];

  for (let roundIndex = 0; roundIndex < memberIds.length - 1; roundIndex += 1) {
    const pairings = [];
    for (let index = 0; index < memberIds.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      pairings.push(
        (roundIndex + index) % 2 === 0
          ? { homeUid: first, awayUid: second }
          : { homeUid: second, awayUid: first },
      );
    }
    rounds.push(pairings);
    rotation.splice(1, 0, rotation.pop());
  }

  return rounds;
}

export function generateRegularSeasonSchedule({
  leagueId,
  season,
  memberIds,
  seasonConfig,
  teamNames = {},
}) {
  if (!leagueId || !Number.isInteger(season) || season < 1) {
    throw new Error("A valid league and season are required for scheduling.");
  }
  if (
    !Array.isArray(memberIds) ||
    memberIds.length < 2 ||
    memberIds.length % 2 !== 0 ||
    new Set(memberIds).size !== memberIds.length
  ) {
    throw new Error("The schedule requires a unique, even-sized member order.");
  }

  const config = normalizeSeasonConfig(memberIds.length, seasonConfig);
  const baseRounds = buildRoundRobinCycle(memberIds);
  const opponentCycles = config.gamesPerTeam / baseRounds.length;
  if (!Number.isInteger(opponentCycles) || opponentCycles % 2 !== 0) {
    throw new Error("Season configuration must contain complete balanced cycles.");
  }

  const games = [];
  for (let cycle = 0; cycle < opponentCycles; cycle += 1) {
    baseRounds.forEach((pairings, roundIndex) => {
      const round = cycle * baseRounds.length + roundIndex + 1;
      pairings.forEach((pairing) => {
        const gameNumber = games.length + 1;
        const oriented =
          cycle % 2 === 0
            ? pairing
            : { homeUid: pairing.awayUid, awayUid: pairing.homeUid };
        const id = createScheduleGameId({
          season,
          scheduleVersion: config.scheduleVersion,
          round,
          gameNumber,
        });
        games.push({
          id,
          leagueId,
          season,
          scheduleVersion: config.scheduleVersion,
          round,
          gameNumber,
          homeUid: oriented.homeUid,
          awayUid: oriented.awayUid,
          homeTeamName: teamNames[oriented.homeUid] || oriented.homeUid,
          awayTeamName: teamNames[oriented.awayUid] || oriented.awayUid,
          status: OFFICIAL_GAME_STATUS.SCHEDULED,
          scheduledOrder: gameNumber,
        });
      });
    });
  }

  return {
    games,
    metadata: {
      version: config.scheduleVersion,
      generatedForSeason: season,
      totalGames: games.length,
      totalRounds: config.gamesPerTeam,
    },
  };
}

export function isCurrentScheduleMetadata(league, seasonConfig) {
  const schedule = league?.schedule;
  return Boolean(
    schedule &&
      schedule.version === seasonConfig.scheduleVersion &&
      schedule.generatedForSeason === league.season &&
      schedule.totalGames ===
        (league.memberIds.length * seasonConfig.gamesPerTeam) / 2 &&
      schedule.totalRounds === seasonConfig.gamesPerTeam,
  );
}
