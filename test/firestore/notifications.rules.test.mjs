import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

let environment;
const projectId = "phase19-notification-rules";
before(async () => { environment = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8") } }); });
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("users/a/notifications/n1").set({ type: "follow", actorUid: "b", createdAt: new Date(), read: false, metadata: {} });
    await context.firestore().doc("users/a/notificationMeta/summary").set({ unreadCount: 1, updatedAt: new Date() });
  });
});
after(async () => environment.cleanup());

test("owner may read notification list and summary", async () => {
  const database = environment.authenticatedContext("a").firestore();
  await assertSucceeds(getDocs(collection(database, "users/a/notifications")));
  await assertSucceeds(getDoc(doc(database, "users/a/notificationMeta/summary")));
});

test("another user cannot read private notifications", async () => {
  const database = environment.authenticatedContext("b").firestore();
  await assertFails(getDoc(doc(database, "users/a/notifications/n1")));
  await assertFails(getDoc(doc(database, "users/a/notificationMeta/summary")));
});

test("normal clients cannot create notifications or mark them read directly", async () => {
  const database = environment.authenticatedContext("a").firestore();
  await assertFails(setDoc(doc(database, "users/a/notifications/n2"), { type: "follow", read: false }));
  await assertFails(updateDoc(doc(database, "users/a/notifications/n1"), { read: true }));
  await assertFails(updateDoc(doc(database, "users/a/notificationMeta/summary"), { unreadCount: 0 }));
});
