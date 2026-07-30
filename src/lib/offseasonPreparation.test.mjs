import assert from "node:assert/strict";
import test from "node:test";
import { buildOffseasonReadyMemberIds, getOffseasonTeamPreparationState, normalizeOffseasonPreparation } from "./offseasonPreparation.js";

const roster = ["PG", "SG", "SF", "PF", "C"].map((position) => ({ id: position.toLowerCase(), position }));
const lineup = Object.fromEntries(roster.map((player) => [player.position, player.id]));
const team = { ownerUid: "a", roster, lineup };
const league = { status: "offseason", season: 1, memberIds: ["a", "b"], offseason: { seasonCompleted: 1, nextSeason: 2, status: "open", preparationVersion: 1, readyMemberIds: [] } };

test("dynasty roster, lineup, ownership reference, history, and active season remain unchanged", () => {
  const state = getOffseasonTeamPreparationState({ league, team, userId: "a" });
  assert.equal(team.roster, roster);
  assert.equal(team.lineup, lineup);
  assert.equal(team.ownerUid, "a");
  assert.equal(league.season, 1);
  assert.equal(state.nextSeason, 2);
  assert.equal(state.requirements.lineupValid, true);
});

test("valid existing lineup still requires explicit next-season confirmation", () => {
  const state = getOffseasonTeamPreparationState({ league, team, userId: "a" });
  assert.equal(state.requirements.rosterValid, true);
  assert.equal(state.requirements.ownerConfirmed, false);
  assert.equal(state.ready, false);
});

test("only an owner can confirm their own franchise", () => {
  assert.throws(() => buildOffseasonReadyMemberIds({ league, actorUid: "a", targetUid: "b", confirmed: true, team }), /only confirm their own/);
  assert.deepEqual(buildOffseasonReadyMemberIds({ league, actorUid: "a", targetUid: "a", confirmed: true, team }), ["a"]);
});

test("franchises confirm independently and lineup editing can remove confirmation", () => {
  const first = buildOffseasonReadyMemberIds({ league, actorUid: "a", targetUid: "a", confirmed: true, team });
  const withFirst = { ...league, offseason: { ...league.offseason, readyMemberIds: first } };
  const second = buildOffseasonReadyMemberIds({ league: withFirst, actorUid: "b", targetUid: "b", confirmed: true, team: { ...team, ownerUid: "b" } });
  assert.deepEqual(second, ["a", "b"]);
  assert.deepEqual(buildOffseasonReadyMemberIds({ league: { ...league, offseason: { ...league.offseason, readyMemberIds: second } }, actorUid: "a", targetUid: "a", confirmed: false, team }), ["b"]);
});

test("readiness is scoped to nextSeason and stale readiness cannot carry forward", () => {
  const stale = { ...league, season: 2, offseason: { ...league.offseason, nextSeason: 2, readyMemberIds: ["a"] } };
  assert.deepEqual(normalizeOffseasonPreparation(stale).readyMemberIds, []);
  assert.equal(normalizeOffseasonPreparation(stale).nextSeason, 2);
});

test("legacy offseason documents load with a deterministic empty readiness list", () => {
  assert.deepEqual(normalizeOffseasonPreparation({ status: "offseason", season: 1, offseason: { seasonCompleted: 1, nextSeason: 2, status: "open" } }), { preparationVersion: 1, nextSeason: 2, readyMemberIds: [] });
});
