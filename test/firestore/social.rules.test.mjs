import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

let environment;
const projectId = "phase18-social-rules";
const profile = (uid, name) => ({ uid, displayName: name, photoURL: "", bannerURL: "", joinedAt: new Date(), followersCount: 0, followingCount: 0, updatedAt: new Date() });

before(async () => { environment = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8") } }); });
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/a").set({ displayName: "A", email: "a@example.com", activeLeagueId: "private" });
    await context.firestore().doc("users/b").set({ displayName: "B", email: "b@example.com", activeLeagueId: "private" });
    await context.firestore().doc("publicProfiles/a").set(profile("a", "A"));
    await context.firestore().doc("publicProfiles/b").set(profile("b", "B"));
  });
});
after(async () => environment.cleanup());

test("authenticated users read public projection but not another private user document", async () => {
  const database = environment.authenticatedContext("a").firestore();
  await assertSucceeds(getDoc(doc(database, "publicProfiles", "b")));
  await assertFails(getDoc(doc(database, "users", "b")));
});

test("owner edits presentation but nobody directly edits counters or another profile", async () => {
  const owner = environment.authenticatedContext("a").firestore();
  await assertSucceeds(updateDoc(doc(owner, "publicProfiles", "a"), { displayName: "A GM", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, "publicProfiles", "a"), { followersCount: 99, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, "publicProfiles", "b"), { displayName: "Spoof", updatedAt: serverTimestamp() }));
});

test("normal clients cannot create either relationship edge", async () => {
  const database = environment.authenticatedContext("a").firestore();
  await assertFails(setDoc(doc(database, "publicProfiles", "a", "following", "b"), { uid: "b", createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(database, "publicProfiles", "b", "followers", "a"), { uid: "a", createdAt: serverTimestamp() }));
});
