import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficialCompletion,
  buildOfficialGameActivation,
  isOfficialLeagueGamePath,
  simulateOfficialGame,
} from "../lib/completeOfficialGame.js";

const roster = (prefix, overall) => ["PG", "SG", "SF", "PF", "C"].map((position, index) => ({
  id: `${prefix}-${index}`,
  name: `${prefix} ${position}`,
  position,
  overall: overall + index,
  stats: { points: 20 + index, rebounds: 5 + index, assists: 4 + index },
}));
const team = (uid, prefix, overall, record = { wins: 0, losses: 0 }) => {
  const players = roster(prefix, overall);
  return {
    ownerUid: uid,
    name: `${prefix} Team`,
    roster: players,
    lineup: Object.fromEntries(players.map((player) => [player.position, player.id])),
    strategy: "balanced",
    record,
  };
};
const identity = {
  leagueId: "league-1",
  gameId: "game-1",
  season: 1,
  scheduleVersion: 1,
  homeUid: "home",
  awayUid: "away",
};

test("the same official seed produces the same result and box score", () => {
  const input = { gameIdentity: identity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) };
  assert.deepEqual(simulateOfficialGame(input), simulateOfficialGame(input));
});

test("the same official seed produces the same ordered timeline", () => {
  const input = { gameIdentity: identity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) };
  const first = simulateOfficialGame(input).timeline;
  const second = simulateOfficialGame(input).timeline;
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((event) => event.sequence), first.map((_, index) => index + 1));
});

test("timeline final score and progressive player stats match the box score", () => {
  const simulation = simulateOfficialGame({ gameIdentity: identity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) });
  const end = simulation.timeline.at(-1);
  assert.equal(end.eventType, "game_end");
  assert.equal(end.homeScore, simulation.result.homeScore);
  assert.equal(end.awayScore, simulation.result.awayScore);

  const totals = {};
  simulation.timeline.forEach((event) => event.statDeltas.forEach(({ playerId, side, ...delta }) => {
    const key = `${side}:${playerId}`;
    totals[key] ||= { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
    Object.entries(delta).forEach(([stat, value]) => { totals[key][stat] += value; });
  }));
  for (const side of ["home", "away"]) {
    simulation.boxScore[side].players.forEach((player) => {
      const expected = Object.fromEntries(Object.keys(totals[`${side}:${player.playerId}`] || { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 }).map((stat) => [stat, player.stats[stat]]));
      assert.deepEqual(totals[`${side}:${player.playerId}`] || { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 }, expected);
    });
  }
});

test("the authoritative timeline contains exactly one game_end", () => {
  const { timeline } = simulateOfficialGame({ gameIdentity: identity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) });
  assert.equal(timeline.filter((event) => event.eventType === "game_end").length, 1);
});

test("winner and loser match the generated score", () => {
  const { result } = simulateOfficialGame({ gameIdentity: identity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) });
  assert.notEqual(result.homeScore, result.awayScore);
  assert.equal(result.winnerUid, result.homeScore > result.awayScore ? "home" : "away");
  assert.equal(result.loserUid, result.homeScore > result.awayScore ? "away" : "home");
});

test("records update once and a completed retry is immutable", () => {
  const homeTeam = team("home", "H", 82, { wins: 3, losses: 1 });
  const awayTeam = team("away", "A", 80, { wins: 2, losses: 2 });
  const simulation = simulateOfficialGame({ gameIdentity: identity, homeTeam, awayTeam });
  const first = buildOfficialCompletion({ game: { ...identity, status: "in_progress" }, homeTeam, awayTeam, simulation });
  assert.equal(first.homeRecord.wins + first.homeRecord.losses, 5);
  assert.equal(first.awayRecord.wins + first.awayRecord.losses, 5);
  const presentation = { version: 1, durationMs: 60000, startedAt: 1000 };
  const retry = buildOfficialCompletion({ game: { ...identity, status: "completed", result: first.result, boxScore: first.boxScore, timeline: first.timeline, presentation }, homeTeam: { ...homeTeam, record: first.homeRecord }, awayTeam: { ...awayTeam, record: first.awayRecord }, simulation });
  assert.deepEqual(retry, { alreadyCompleted: true, result: first.result, boxScore: first.boxScore, timeline: first.timeline, presentation });
  assert.equal("homeRecord" in retry, false);
});

test("trusted round start activates a scheduled snapshot without completing it", () => {
  const homeTeam = team("home", "H", 82);
  const awayTeam = team("away", "A", 80);
  const activation = buildOfficialGameActivation({
    game: { ...identity, id: identity.gameId, status: "scheduled" },
    homeTeam,
    awayTeam,
    startedAt: 1_000,
    endsAt: 61_000,
  });
  assert.equal(activation.status, "in_progress");
  assert.ok(activation.result);
  assert.ok(activation.timeline.length > 0);
  assert.ok(activation.boxScore);
  assert.equal(activation.presentation.startedAt, 1_000);
  assert.equal(activation.presentation.endsAt, 61_000);
  assert.equal("completedAt" in activation, false);
});

test("expanded rosters simulate only the configured Starting Five", () => {
  const expand = (source, prefix) => ({ ...source, roster: [...source.roster, ...[0, 1, 2].map((index) => ({ id: `${prefix}-bench-${index}`, name: `${prefix} Bench ${index}`, position: index === 0 ? "PG" : index === 1 ? "SF" : "C", overall: 80 }))] });
  const homeTeam = expand(team("home", "H", 82), "H");
  const awayTeam = expand(team("away", "A", 80), "A");
  const activation = buildOfficialGameActivation({ game: { ...identity, id: identity.gameId, status: "scheduled" }, homeTeam, awayTeam, startedAt: 1_000, endsAt: 61_000, rosterSize: 8 });
  assert.equal(activation.boxScore.home.players.length, 5);
  assert.equal(activation.boxScore.away.players.length, 5);
  assert.equal(activation.boxScore.home.players.some((player) => player.playerId.includes("bench")), false);
});

test("activation retry cannot regenerate an already in-progress game", () => {
  assert.throws(() => buildOfficialGameActivation({
    game: { ...identity, id: identity.gameId, status: "in_progress" },
    homeTeam: team("home", "H", 82),
    awayTeam: team("away", "A", 80),
    startedAt: 1_000,
    endsAt: 61_000,
  }), /Only a scheduled official game can be activated/);
});

test("playoff round start uses the same scheduled-to-in-progress activation", () => {
  const activation = buildOfficialGameActivation({
    game: { ...identity, id: "semifinal-1", gameId: "semifinal-1", status: "scheduled", stage: "semifinal" },
    homeTeam: team("home", "H", 82),
    awayTeam: team("away", "A", 80),
    startedAt: 5_000,
    endsAt: 65_000,
  });
  assert.equal(activation.status, "in_progress");
  assert.equal(activation.timeline.at(-1).eventType, "game_end");
  assert.equal("completedAt" in activation, false);
});

test("completion still rejects a genuinely scheduled game", () => {
  const homeTeam = team("home", "H", 82);
  const awayTeam = team("away", "A", 80);
  const simulation = simulateOfficialGame({ gameIdentity: identity, homeTeam, awayTeam });
  assert.throws(() => buildOfficialCompletion({ game: { ...identity, status: "scheduled" }, homeTeam, awayTeam, simulation }), /Only an in-progress official game can be completed/);
});

test("only league-scoped official paths are record eligible", () => {
  assert.equal(isOfficialLeagueGamePath("leagues/l1/games/g1"), true);
  assert.equal(isOfficialLeagueGamePath("matches/private-1"), false);
  assert.equal(isOfficialLeagueGamePath("matches/exhibition-1"), false);
});
