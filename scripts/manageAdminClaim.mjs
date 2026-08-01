import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const action = args.includes("--grant") ? "grant" : args.includes("--revoke") ? "revoke" : args.includes("--inspect") ? "inspect" : null;
const uid = valueAfter("--uid");
const email = valueAfter("--email");
if (!action || (!uid && !email) || (uid && email)) {
  throw new Error("Usage: node scripts/manageAdminClaim.mjs --grant|--revoke|--inspect --uid <uid> OR --email <email>");
}
if (!getApps().length) initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
if (action === "inspect") {
  console.log(JSON.stringify({ uid: user.uid, admin: user.customClaims?.admin === true }, null, 2));
} else {
  const claims = { ...(user.customClaims || {}) };
  if (action === "grant") claims.admin = true;
  else delete claims.admin;
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`Admin claim ${action === "grant" ? "granted" : "revoked"} for UID ${user.uid}. The user must sign out and sign back in.`);
}
