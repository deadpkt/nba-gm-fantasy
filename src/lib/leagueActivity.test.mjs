import test from "node:test";
import assert from "node:assert/strict";
import { groupLeagueActivity, leagueActivityPresentation, leagueActivityRoute } from "./leagueActivity.js";

test("structured activity derives expected league copy", () => {
  assert.equal(leagueActivityPresentation({ type: "player_drafted", metadata: { actorName: "Batu", playerName: "Stephen Curry" } }).text, "Batu selected Stephen Curry.");
  assert.equal(leagueActivityPresentation({ type: "game_finished", metadata: { winnerName: "Batu Ballers", loserName: "Court Kings" } }).text, "Batu Ballers defeated Court Kings.");
  assert.equal(leagueActivityPresentation({ type: "champion_crowned", metadata: { teamName: "Batu Ballers", season: 2 } }).text, "Batu Ballers won Season 2.");
});

test("only meaningful supported activity destinations resolve", () => {
  assert.equal(leagueActivityRoute({ type: "game_finished" }), "/games");
  assert.equal(leagueActivityRoute({ type: "champion_crowned" }), "/league/history");
  assert.equal(leagueActivityRoute({ type: "player_drafted" }), null);
});

test("lifecycle activity has concise presentation", () => {
  assert.equal(leagueActivityPresentation({ type: "next_season_started", metadata: { season: 3 } }).text, "Season 3 preparation started.");
  assert.equal(leagueActivityPresentation({ type: "league_archived", metadata: {} }).text, "The league was archived.");
});

test("activity groups naturally without excessive separators", () => {
  const now = new Date(2026, 7, 10, 12);
  const groups = groupLeagueActivity([{ id: "a", createdAt: new Date(2026, 7, 10) }, { id: "b", createdAt: new Date(2026, 7, 2) }], now);
  assert.deepEqual(groups.map(([name]) => name), ["Today", "Earlier"]);
});
