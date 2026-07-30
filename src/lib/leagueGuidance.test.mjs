import assert from "node:assert/strict";
import test from "node:test";
import { getLeagueNextAction, getLeagueProgress } from "./leagueGuidance.js";

const league = { id: "league-1", status: "season_ready", season: 1, commissionerUid: "commissioner", maxMembers: 4 };

test("season-ready owner is guided to confirm an incomplete lineup", () => {
  const result = getLeagueNextAction({ league, userId: "member", teamReady: false, readyCount: 3, totalMembers: 4 });
  assert.equal(result.actionPath, "/my-team");
  assert.match(result.title, /starting five/i);
});

test("commissioner can start only after every season-ready franchise is ready", () => {
  const waiting = getLeagueNextAction({ league, userId: "commissioner", teamReady: true, allTeamsReady: false, readyCount: 3, totalMembers: 4 });
  const ready = getLeagueNextAction({ league, userId: "commissioner", teamReady: true, allTeamsReady: true, readyCount: 4, totalMembers: 4 });
  assert.match(waiting.blockedReason, /1 franchise remaining/i);
  assert.equal(ready.actionLabel, "Start Season");
});

test("regular-season participant is guided to a live matchup", () => {
  const result = getLeagueNextAction({ league: { ...league, status: "regular_season" }, userId: "member", currentRound: 2, currentMatchup: { status: "in_progress", homeTeamName: "Home", awayTeamName: "Away" } });
  assert.equal(result.actionLabel, "Watch Live");
  assert.equal(result.actionPath, "/games");
});

test("progress is deterministic for every lifecycle phase", () => {
  assert.deepEqual(getLeagueProgress("season_ready").map((step) => step.state), ["complete", "complete", "active", "upcoming", "upcoming", "upcoming"]);
});
