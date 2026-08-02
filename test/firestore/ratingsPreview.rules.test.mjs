import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
let environment;
before(async () => { environment = await initializeTestEnvironment({ projectId: "ratings-preview-rules", firestore: { rules: await readFile("firestore.rules", "utf8") } }); });
beforeEach(async () => { await environment.clearFirestore(); await environment.withSecurityRulesDisabled(async (context) => { await context.firestore().doc("playerDataImports/preview-1").set({ formulaVersion: "ratings-v2.0.0", publication: { enabled: false } }); await context.firestore().doc("playerDataImports/preview-1/players/p1").set({ overall: 82 }); }); });
after(async () => environment.cleanup());
test("only explicit admins can inspect ratings staging", async () => {
  const admin = environment.authenticatedContext("admin", { admin: true }).firestore();
  const member = environment.authenticatedContext("member").firestore();
  await assertSucceeds(getDoc(doc(admin, "playerDataImports/preview-1")));
  await assertSucceeds(getDocs(collection(admin, "playerDataImports/preview-1/players")));
  await assertFails(getDoc(doc(member, "playerDataImports/preview-1")));
  await assertFails(getDocs(collection(member, "playerDataImports/preview-1/players")));
});
test("all client writes remain blocked, including admins", async () => {
  const admin = environment.authenticatedContext("admin", { admin: true }).firestore();
  await assertFails(setDoc(doc(admin, "playerDataImports/preview-2"), { publication: { enabled: false } }));
  await assertFails(setDoc(doc(admin, "playerDataImports/preview-1/players/p2"), { overall: 99 }));
});

