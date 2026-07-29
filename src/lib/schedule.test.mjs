import assert from "node:assert/strict";
import test from "node:test";
import { generateRegularSeasonSchedule } from "./schedule.js";
import {
  createSeasonConfig,
  SEASON_PRESET,
  SUPPORTED_LEAGUE_SIZES,
} from "./seasonConfig.js";

for (const teamCount of SUPPORTED_LEAGUE_SIZES) {
  for (const preset of Object.values(SEASON_PRESET)) {
    test(`${teamCount}-team ${preset} schedule is fair and deterministic`, () => {
      const memberIds = Array.from(
        { length: teamCount },
        (_, index) => `team-${index + 1}`,
      );
      const seasonConfig = createSeasonConfig(teamCount, preset);
      const input = {
        leagueId: "LEAGUE01",
        season: 1,
        memberIds,
        seasonConfig,
        teamNames: Object.fromEntries(
          memberIds.map((uid) => [uid, `Name ${uid}`]),
        ),
      };
      const first = generateRegularSeasonSchedule(input);
      const second = generateRegularSeasonSchedule(input);

      assert.deepEqual(first, second);
      assert.equal(
        first.games.length,
        (teamCount * seasonConfig.gamesPerTeam) / 2,
      );
      assert.equal(first.metadata.totalRounds, seasonConfig.gamesPerTeam);
      assert.equal(new Set(first.games.map((game) => game.id)).size, first.games.length);

      const gamesByTeam = new Map(memberIds.map((uid) => [uid, []]));
      const meetings = new Map();
      const homeMeetings = new Map();
      const teamsByRound = new Map();

      first.games.forEach((game) => {
        gamesByTeam.get(game.homeUid).push(game);
        gamesByTeam.get(game.awayUid).push(game);

        const pair = [game.homeUid, game.awayUid].toSorted().join("|");
        meetings.set(pair, (meetings.get(pair) || 0) + 1);
        const homePair = `${pair}|${game.homeUid}`;
        homeMeetings.set(homePair, (homeMeetings.get(homePair) || 0) + 1);

        const roundTeams = teamsByRound.get(game.round) || new Set();
        assert.equal(roundTeams.has(game.homeUid), false);
        assert.equal(roundTeams.has(game.awayUid), false);
        roundTeams.add(game.homeUid);
        roundTeams.add(game.awayUid);
        teamsByRound.set(game.round, roundTeams);
      });

      gamesByTeam.forEach((games) =>
        assert.equal(games.length, seasonConfig.gamesPerTeam),
      );
      const expectedMeetings =
        seasonConfig.gamesPerTeam / (teamCount - 1);
      meetings.forEach((count, pair) => {
        assert.equal(count, expectedMeetings);
        const [firstUid, secondUid] = pair.split("|");
        assert.equal(homeMeetings.get(`${pair}|${firstUid}`), count / 2);
        assert.equal(homeMeetings.get(`${pair}|${secondUid}`), count / 2);
      });
      teamsByRound.forEach((teams) => assert.equal(teams.size, teamCount));
    });
  }
}
