import assert from "node:assert/strict";
import test from "node:test";
import { LEAGUE_STATUS } from "./leagueStatuses.js";
import { getInternalReturnPath, resolveLeagueRouteAccess, ROUTE_ACCESS } from "./routeAccess.js";

const userId = "member";
const league = (status) => ({ id: "league-1", status, memberIds: ["commissioner", userId], commissionerUid: "commissioner" });
const access = (status, allowedStatuses, pathname) => resolveLeagueRouteAccess({ leagueLoading: false, activeLeagueId: "league-1", activeLeague: league(status), userId, allowedStatuses, pathname });

test("temporary missing activeLeagueId remains loading instead of redirecting", () => {
  assert.deepEqual(resolveLeagueRouteAccess({ leagueLoading: true, activeLeagueId: null, activeLeague: null, userId, allowedStatuses: [LEAGUE_STATUS.DRAFTING], pathname: "/league/draft" }), { status: ROUTE_ACCESS.LOADING, redirectTo: null });
});

test("valid authenticated league routes remain allowed after hydration", () => {
  const cases = [
    [LEAGUE_STATUS.DRAFTING, [LEAGUE_STATUS.DRAFTING], "/league/draft"],
    [LEAGUE_STATUS.SEASON_READY, [LEAGUE_STATUS.SEASON_READY], "/my-team"],
    [LEAGUE_STATUS.REGULAR_SEASON, [LEAGUE_STATUS.REGULAR_SEASON], "/games"],
    [LEAGUE_STATUS.REGULAR_SEASON, [LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS], "/standings"],
    [LEAGUE_STATUS.PLAYOFFS, [LEAGUE_STATUS.PLAYOFFS], "/playoffs"],
    [LEAGUE_STATUS.OFFSEASON, [LEAGUE_STATUS.SEASON_READY, LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS, LEAGUE_STATUS.OFFSEASON], "/contracts"],
    [LEAGUE_STATUS.OFFSEASON, [LEAGUE_STATUS.SEASON_READY, LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS, LEAGUE_STATUS.OFFSEASON], "/league/history"],
  ];
  cases.forEach(([status, statuses, pathname]) => assert.equal(access(status, statuses, pathname).status, ROUTE_ACCESS.ALLOWED));
});

test("lifecycle redirects occur only after resolved authoritative status", () => {
  assert.deepEqual(access(LEAGUE_STATUS.SEASON_READY, [LEAGUE_STATUS.DRAFTING], "/league/draft"), { status: ROUTE_ACCESS.REDIRECT, redirectTo: "/my-team", reason: "draft-completed" });
  assert.deepEqual(access(LEAGUE_STATUS.OFFSEASON, [LEAGUE_STATUS.REGULAR_SEASON], "/games"), { status: ROUTE_ACCESS.REDIRECT, redirectTo: "/league/league-1", reason: "invalid-phase" });
  assert.deepEqual(access(LEAGUE_STATUS.REGULAR_SEASON, [LEAGUE_STATUS.PLAYOFFS], "/playoffs"), { status: ROUTE_ACCESS.REDIRECT, redirectTo: "/league/league-1", reason: "invalid-phase" });
});

test("resolved missing league and membership remain protected", () => {
  assert.equal(resolveLeagueRouteAccess({ leagueLoading: false, activeLeagueId: null, activeLeague: null, userId }).reason, "missing-league");
  assert.equal(resolveLeagueRouteAccess({ leagueLoading: false, activeLeagueId: "league-1", activeLeague: { ...league(LEAGUE_STATUS.REGULAR_SEASON), memberIds: [] }, userId }).reason, "missing-membership");
});

test("login return paths preserve safe internal pathname, query, and hash", () => {
  assert.equal(getInternalReturnPath({ pathname: "/games", search: "?round=2", hash: "#live" }), "/games?round=2#live");
  assert.equal(getInternalReturnPath({ pathname: "https://example.com" }), "/");
  assert.equal(getInternalReturnPath({ pathname: "//example.com/attack" }), "/");
});
