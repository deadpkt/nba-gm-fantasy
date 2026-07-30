import assert from "node:assert/strict";
import test from "node:test";
import { buildExpiredContractCleanup, buildFreeAgentSigning, buildPlayerRelease } from "../shared/freeAgency.js";
import { buildInitialContract } from "../shared/contracts.js";

const player = (id, overall = 85) => ({ id, name: `Player ${id}`, overall, active: true, draftEligible: true, primaryPosition: "PG", eligiblePositions: ["PG"], position: "PG", team: "NBA" });
const roster = Array.from({ length: 7 }, (_, index) => player(`p${index}`, 80));
const league = { status: "offseason", season: 1, memberIds: ["a", "b"], offseason: { readyMemberIds: ["a", "b"] }, rosterConfig: { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 } };
const team = { id: "a", ownerUid: "a", roster, lineup: { PG: "p0", SG: "p1", SF: "p2", PF: "p3", C: "p4" } };
const contracts = roster.map((item) => buildInitialContract({ player: item, ownerUid: "a", leagueSeason: 1, leagueStatus: "regular_season" }));

test("trusted signing appends an eligible unowned player, creates deterministic terms, and resets only actor readiness", () => {
  const result = buildFreeAgentSigning({ league, team, contracts, player: player("new", 90), actorUid: "a" });
  assert.equal(result.roster.length, 8);
  assert.equal(result.contract.ownerUid, "a");
  assert.equal(result.contract.yearsRemaining, 2);
  assert.deepEqual(result.lineup, team.lineup);
  assert.deepEqual(result.readyMemberIds, ["b"]);
});

test("signing rejects non-members, active season, full rosters, ineligible and already-owned players", () => {
  assert.throws(() => buildFreeAgentSigning({ league, team, contracts, player: player("x"), actorUid: "outsider" }), /membership/i);
  assert.throws(() => buildFreeAgentSigning({ league: { ...league, status: "regular_season" }, team, contracts, player: player("x"), actorUid: "a" }), /offseason/i);
  assert.throws(() => buildFreeAgentSigning({ league, team: { ...team, roster: [...roster, player("eighth")] }, contracts: [...contracts, buildInitialContract({ player: player("eighth"), ownerUid: "a", leagueSeason: 1, leagueStatus: "regular_season" })], player: player("x"), actorUid: "a" }), /full/i);
  assert.throws(() => buildFreeAgentSigning({ league, team, contracts, player: { ...player("x"), active: false }, actorUid: "a" }), /eligible/i);
  assert.throws(() => buildFreeAgentSigning({ league, team, contracts, player: player("x"), actorUid: "a", ownershipExists: true }), /no longer available/i);
});

test("salary cap and legacy five-player capacity are enforced", () => {
  const expensive = roster.map((item) => ({ ...buildInitialContract({ player: item, ownerUid: "a", leagueSeason: 1, leagueStatus: "regular_season" }), salary: 20_000_000 }));
  assert.throws(() => buildFreeAgentSigning({ league, team, contracts: expensive, player: player("x", 98), actorUid: "a" }), /salary cap/i);
  const legacyRoster = roster.slice(0, 5);
  assert.throws(() => buildFreeAgentSigning({ league: { ...league, rosterConfig: undefined }, team: { ...team, roster: legacyRoster }, contracts: contracts.slice(0, 5), player: player("x"), actorUid: "a" }), /full at 5/i);
});

test("release removes roster and starting slot and resets only owner readiness", () => {
  const result = buildPlayerRelease({ league, team, contract: contracts[0], playerId: "p0", actorUid: "a", ownershipOwnerUid: "a" });
  assert.equal(result.roster.length, 6);
  assert.equal(result.lineup.PG, null);
  assert.deepEqual(result.readyMemberIds, ["b"]);
  assert.throws(() => buildPlayerRelease({ league, team, contract: contracts[0], playerId: "p0", actorUid: "a", ownershipOwnerUid: "b" }), /owning franchise/i);
});

test("expired cleanup is deterministic and leaves non-expired contracts alone", () => {
  const expired = { ...contracts[0], yearsRemaining: 0 };
  const result = buildExpiredContractCleanup({ league, teams: [team], contracts: [expired, contracts[1]] });
  assert.equal(result.length, 1);
  assert.equal(result[0].player.id, "p0");
  assert.deepEqual(buildExpiredContractCleanup({ league, teams: [{ ...team, roster: result[0].roster }], contracts: [contracts[1]] }), []);
});

test("ownership existence is the deterministic concurrency gate", () => {
  const first = buildFreeAgentSigning({ league, team, contracts, player: player("race"), actorUid: "a", ownershipExists: false });
  assert.equal(first.roster.at(-1).id, "race");
  assert.throws(() => buildFreeAgentSigning({ league, team, contracts, player: player("race"), actorUid: "a", ownershipExists: true }), /no longer available/i);
});
