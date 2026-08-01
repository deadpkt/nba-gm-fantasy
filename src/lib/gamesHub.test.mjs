import test from "node:test";
import assert from "node:assert/strict";
import { buildSeasonTimeline, deriveMatchupStoryline, GAME_HUB_STATUS, getHubGameStatus, getRecentGameLeaders, selectFeaturedGame } from "./gamesHub.js";

const finalGame = (overrides = {}) => ({ id: "g1", round: 1, scheduledOrder: 1, status: "completed", homeUid: "a", awayUid: "b", homeTeamName: "A", awayTeamName: "B", result: { homeScore: 100, awayScore: 90, winnerUid: "a" }, ...overrides });

test("hub status never reveals a final before presentation completion", () => {
  const game = finalGame({ timeline: [{ eventType: "game_end", presentationOffsetMs: 1000 }], presentation: { startedAt: 1000 } });
  assert.equal(getHubGameStatus(game, 1, 1500), GAME_HUB_STATUS.LIVE);
  assert.equal(getHubGameStatus(game, 1, 2100), GAME_HUB_STATUS.FINAL);
});

test("featured game prioritizes a live user game", () => {
  const upcoming = { id: "next", round: 2, scheduledOrder: 2, status: "scheduled", homeUid: "a", awayUid: "c" };
  const live = { id: "live", round: 1, scheduledOrder: 1, status: "in_progress", homeUid: "a", awayUid: "b" };
  assert.equal(selectFeaturedGame([upcoming, live], "a", 1).id, "live");
});

test("season timeline reports visible results and locks later rounds", () => {
  const timeline = buildSeasonTimeline([finalGame(), { id: "g2", round: 2, scheduledOrder: 2, status: "scheduled", homeUid: "b", awayUid: "a" }], "a", 1);
  assert.deepEqual(timeline.map(({ state }) => state), ["W", GAME_HUB_STATUS.LOCKED]);
  assert.equal(timeline[0].score, "100-90");
});

test("storylines are emitted only from authoritative standings context", () => {
  const game = finalGame({ id: "next", status: "scheduled", round: 2 });
  const standings = [{ teamUid: "a", teamName: "A", rank: 1, gp: 3, wins: 3, losses: 0, streak: "W3" }, { teamUid: "b", teamName: "B", rank: 2, gp: 3, wins: 2, losses: 1, streak: "W1" }];
  assert.equal(deriveMatchupStoryline(game, standings), "A matchup at the top of the league table.");
  assert.equal(deriveMatchupStoryline(game, []), "");
});

test("recent leaders use visible box score data", () => {
  const game = finalGame({ boxScore: { home: { teamName: "A", players: [{ name: "Ace", stats: { points: 30, rebounds: 8, assists: 4 } }] }, away: { teamName: "B", players: [{ name: "Bee", stats: { points: 20, rebounds: 11, assists: 9 } }] } } });
  assert.deepEqual(getRecentGameLeaders(game).map(({ playerName }) => playerName), ["Ace", "Bee", "Bee"]);
});
