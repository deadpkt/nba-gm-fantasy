import test from "node:test";
import assert from "node:assert/strict";
import { buildArchiveUpdate, buildDepartingMemberUpdate, canArchiveLeague, canLeaveLeagueDynasty, resizeSeasonConfig } from "../shared/leagueLifecycle.js";

const league = { status: "offseason", commissionerUid: "a", memberIds: ["a", "b"], readyMemberIds: ["b"], seasonReadyMemberIds: ["b"], offseason: { readyMemberIds: ["a", "b"], nextSeason: 2 } };

test("normal member can leave only in offseason and removes only current state", () => {
  assert.equal(canLeaveLeagueDynasty(league, "b").allowed, true);
  const update = buildDepartingMemberUpdate(league, "b", 10);
  assert.deepEqual(update.memberIds, ["a"]);
  assert.deepEqual(update.offseason.readyMemberIds, ["a"]);
  assert.deepEqual(update.seasonReadyMemberIds, []);
  assert.equal(canLeaveLeagueDynasty({ ...league, status: "regular_season" }, "b").reason, "OFFSEASON_REQUIRED");
});

test("commissioner leave is blocked while another member remains", () => {
  assert.equal(canLeaveLeagueDynasty(league, "a").reason, "COMMISSIONER_TRANSFER_REQUIRED");
  assert.equal(canLeaveLeagueDynasty({ ...league, memberIds: ["a"] }, "a").reason, "COMMISSIONER_TRANSFER_REQUIRED");
});

test("archive is commissioner-only, offseason-only, and idempotent", () => {
  assert.equal(canArchiveLeague(league, "b").allowed, false);
  assert.equal(canArchiveLeague({ ...league, status: "playoffs" }, "a").allowed, false);
  assert.equal(buildArchiveUpdate(league, "a", 20).status, "archived");
  assert.equal(buildArchiveUpdate({ ...league, status: "archived" }, "a", 30), null);
});

test("next-season resize preserves a valid preset", () => {
  assert.deepEqual(resizeSeasonConfig({ preset: "SHORT" }, 2), { preset: "SHORT", gamesPerTeam: 2, scheduleVersion: 1 });
  assert.throws(() => resizeSeasonConfig({ preset: "FULL" }, 3), /2, 4, 6, or 8/);
});
