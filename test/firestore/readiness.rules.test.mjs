import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

const projectId = "roster-readiness-rules";
const leagueId = "league-v2";
const commissionerUid = "commissioner";
const memberUid = "member";
let environment;

const positions = ["PG", "SG", "SF", "PF", "C"];
const roster = (prefix, size = 8) => Array.from({ length: size }, (_, index) => {
  const position = positions[index % positions.length];
  return { id: `bdl_${prefix}_${index}`, name: `${prefix} ${index}`, position, primaryPosition: position, eligiblePositions: [position] };
});
const lineup = (players) => Object.fromEntries(positions.map((position, index) => [position, players[index].id]));

async function seed({ readyMemberIds = [], memberRoster = roster("member"), memberLineup = lineup(memberRoster), legacy = false } = {}) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const league = {
      commissionerUid,
      memberIds: [commissionerUid, memberUid],
      status: "season_ready",
      seasonReadyMemberIds: readyMemberIds,
      ...(legacy ? {} : { rosterConfig: { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 } }),
    };
    const commissionerRoster = roster("commissioner", legacy ? 5 : 8);
    await database.doc(`leagues/${leagueId}`).set(league);
    await database.doc(`leagues/${leagueId}/teams/${commissionerUid}`).set({ ownerUid: commissionerUid, roster: commissionerRoster, lineup: lineup(commissionerRoster) });
    await database.doc(`leagues/${leagueId}/teams/${memberUid}`).set({ ownerUid: memberUid, roster: memberRoster, lineup: memberLineup });
  });
}

const confirm = (actorUid, readyMemberIds) => updateDoc(
  doc(environment.authenticatedContext(actorUid).firestore(), "leagues", leagueId),
  { seasonReadyMemberIds: readyMemberIds, updatedAt: serverTimestamp() },
);

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8") } });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

test("commissioner and normal member can each confirm only themselves", async () => {
  await seed();
  await assertSucceeds(confirm(commissionerUid, [commissionerUid]));
  await assertSucceeds(confirm(memberUid, [commissionerUid, memberUid]));
});

test("neither member nor commissioner can confirm the other franchise", async () => {
  await seed();
  await assertFails(confirm(memberUid, [commissionerUid]));
  await assertFails(confirm(commissionerUid, [memberUid]));
});

test("normal member can unconfirm only themselves", async () => {
  await seed({ readyMemberIds: [commissionerUid, memberUid] });
  await assertSucceeds(confirm(memberUid, [commissionerUid]));
  await assertFails(confirm(memberUid, []));
});

test("configured roster size and position eligibility are enforced", async () => {
  const seven = roster("member", 7);
  await seed({ memberRoster: seven, memberLineup: lineup(seven) });
  await assertFails(confirm(memberUid, [memberUid]));
  await environment.clearFirestore();
  const invalid = roster("member");
  await seed({ memberRoster: invalid, memberLineup: { ...lineup(invalid), C: invalid[0].id } });
  await assertFails(confirm(memberUid, [memberUid]));
});

test("legacy five-player league remains confirmable", async () => {
  const legacyRoster = roster("member", 5);
  await seed({ legacy: true, memberRoster: legacyRoster, memberLineup: lineup(legacyRoster) });
  await assertSucceeds(confirm(memberUid, [memberUid]));
  assert.equal(legacyRoster.length, 5);
});
