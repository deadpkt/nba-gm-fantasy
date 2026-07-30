import assert from "node:assert/strict";
import test from "node:test";
import { buildPreseasonRosterRepair } from "../shared/preseasonRosterRepair.js";

const player = (id, positions, extra = {}) => ({ id, name: id, overall: 80, active: true, draftEligible: true, primaryPosition: positions[0], eligiblePositions: positions, position: positions[0], team: "NBA", ...extra });
const roster = [player("sg", ["SG"]), player("sf", ["SF"]), player("pf", ["PF"]), player("c", ["C"]), player("b1", ["C"]), player("b2", ["PF"]), player("b3", ["SF"]), player("drop", ["C"])];
const league = { status: "season_ready", season: 1, memberIds: ["a", "b"], seasonReadyMemberIds: ["a", "b"], rosterConfig: { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 } };
const team = { ownerUid: "a", roster, lineup: { PG: null, SG: "sg", SF: "sf", PF: "pf", C: "drop" } };
const repair = (overrides = {}) => buildPreseasonRosterRepair({ league, team, actorUid: "a", dropPlayerId: "drop", incomingPlayer: player("pg", ["PG"]), dropOwnershipOwnerUid: "a", ...overrides });

test("stuck owner can atomically-shaped repair to a same-size feasible roster", () => {
  const result = repair();
  assert.equal(result.roster.length, 8);
  assert.equal(result.feasibility.valid, true);
  assert.equal(result.lineup.C, null);
  assert.deepEqual(result.readyMemberIds, ["b"]);
  assert.equal(result.newContract, null);
});

test("repair rejects valid rosters, another owner, non-member, and owned or ineligible additions", () => {
  assert.throws(() => repair({ team: { ...team, roster: team.roster.map((item) => item.id === "b1" ? player("existing-pg", ["PG"]) : item) } }), /infeasible/i);
  assert.throws(() => repair({ actorUid: "b" }), /owner/i);
  assert.throws(() => repair({ actorUid: "x" }), /owner/i);
  assert.throws(() => repair({ addOwnershipExists: true }), /no longer available/i);
  assert.throws(() => repair({ incomingPlayer: player("retired", ["PG"], { active: false, draftEligible: false }) }), /eligible/i);
});

test("replacement must resolve feasibility and ownership must match", () => {
  assert.throws(() => repair({ incomingPlayer: player("another-c", ["C"]) }), /legal Starting Five/i);
  assert.throws(() => repair({ dropOwnershipOwnerUid: "b" }), /not owned/i);
});

test("legacy full five-player rosters use the same repair without expanding", () => {
  const legacyTeam = { ...team, roster: roster.slice(0, 4).concat(player("drop", ["C"])) };
  const result = repair({ league: { ...league, rosterConfig: undefined }, team: legacyTeam });
  assert.equal(result.roster.length, 5);
  assert.equal(result.feasibility.valid, true);
});
