import assert from "node:assert/strict";
import test from "node:test";
import { getHeaderNavigation, getPrimaryNavigationItems } from "./headerNavigation.js";
import { LEAGUE_STATUS } from "./leagueStatuses.js";

test("navigation is lifecycle-specific and never exposes a Navigate label", () => {
  const cases = [
    [null, null, []],
    ["league", LEAGUE_STATUS.DRAFTING, ["Draft"]],
    ["league", LEAGUE_STATUS.SEASON_READY, ["My Team"]],
    ["league", LEAGUE_STATUS.REGULAR_SEASON, ["My Team", "Games", "Standings"]],
    ["league", LEAGUE_STATUS.PLAYOFFS, ["My Team", "Standings", "Playoffs"]],
    ["league", LEAGUE_STATUS.OFFSEASON, ["My Team", "Free Agency", "Contracts"]],
    ["league", LEAGUE_STATUS.ARCHIVED, []],
  ];
  for (const [leagueId, status, labels] of cases) {
    const actual = getHeaderNavigation(leagueId, status).map((item) => item.label);
    assert.deepEqual(actual, labels);
    assert.equal(actual.includes("Navigate"), false);
  }
});

test("mobile primary navigation is hydration-safe and minimal without a league", () => {
  assert.deepEqual(getPrimaryNavigationItems({ loading: true }), []);
  assert.deepEqual(getPrimaryNavigationItems({ activeLeagueId: null, status: null }).map((item) => item.label), ["League"]);
});

test("mobile primary navigation follows the authoritative lifecycle routes", () => {
  const cases = [
    [LEAGUE_STATUS.LOBBY, ["League"]],
    [LEAGUE_STATUS.DRAFTING, ["League", "Draft"]],
    [LEAGUE_STATUS.SEASON_READY, ["League", "My Team"]],
    [LEAGUE_STATUS.REGULAR_SEASON, ["League", "My Team", "Games", "Standings"]],
    [LEAGUE_STATUS.PLAYOFFS, ["League", "My Team", "Standings", "Playoffs"]],
    [LEAGUE_STATUS.OFFSEASON, ["League", "My Team", "Free Agency", "Contracts", "History"]],
    [LEAGUE_STATUS.ARCHIVED, ["League"]],
  ];
  for (const [status, expected] of cases) {
    const items = getPrimaryNavigationItems({ activeLeagueId: "league", status });
    assert.deepEqual(items.map((item) => item.label), expected);
    assert.equal(new Set(items.map((item) => item.to)).size, items.length);
  }
});

test("account destinations never leak into primary lifecycle navigation", () => {
  const labels = getPrimaryNavigationItems({ activeLeagueId: "league", status: LEAGUE_STATUS.REGULAR_SEASON }).map((item) => item.label);
  for (const accountLabel of ["Profile", "Notifications", "Settings", "Logout"]) assert.equal(labels.includes(accountLabel), false);
});
