import assert from "node:assert/strict";
import test from "node:test";
import { getHeaderNavigation } from "./headerNavigation.js";
import { LEAGUE_STATUS } from "./leagueStatuses.js";

test("navigation is lifecycle-specific and never exposes a Navigate label", () => {
  const cases = [
    [null, null, []],
    ["league", LEAGUE_STATUS.DRAFTING, ["Draft"]],
    ["league", LEAGUE_STATUS.SEASON_READY, ["My Team"]],
    ["league", LEAGUE_STATUS.REGULAR_SEASON, ["My Team", "Games", "Standings"]],
    ["league", LEAGUE_STATUS.PLAYOFFS, ["My Team", "Standings", "Playoffs"]],
    ["league", LEAGUE_STATUS.OFFSEASON, ["My Team", "Free Agency", "Contracts"]],
  ];
  for (const [leagueId, status, labels] of cases) {
    const actual = getHeaderNavigation(leagueId, status).map((item) => item.label);
    assert.deepEqual(actual, labels);
    assert.equal(actual.includes("Navigate"), false);
  }
});
