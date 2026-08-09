import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { syncNbaCatalog } from "../../functions/lib/syncNbaCatalog.js";
import { createBalldontlieClient } from "../../functions/providers/balldontlie/client.js";
import { loadLocalEnv, requireLocalEnv } from "../lib/loadLocalEnv.mjs";

loadLocalEnv();

function initializeAdmin() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({ credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault() });
}

async function main() {
  if (process.argv.includes("--provider-test")) {
    const apiKey = requireLocalEnv("BALLDONTLIE_API_KEY");
    console.log("Provider-only diagnostic: Firestore will not be initialized or written.");
    console.log("Connecting to BALLDONTLIE...");
    const client = createBalldontlieClient({ apiKey, logger: console.log });
    const response = await client.request("/players", { per_page: 100 });
    if (!Array.isArray(response?.data)) throw new Error("Provider response is missing a data array.");
    console.log("HTTP success.");
    console.log(`Players returned: ${response.data.length}`);
    console.log(`Next cursor: ${response.meta?.next_cursor ?? "none"}`);
    console.log("API key: configured (value hidden).");
    return;
  }
  if (!process.argv.includes("--write") || !process.argv.includes("--confirm")) {
    console.log("Dry run only: no provider request or Firestore write was made.");
    console.log("To run the trusted upsert sync, use: npm run sync:nba-catalog -- --write --confirm");
    return;
  }
  const apiKey = requireLocalEnv("BALLDONTLIE_API_KEY");
  console.log("Initializing Firebase Admin credentials...");
  initializeAdmin();
  console.log("Firebase Admin initialized. Starting trusted catalog sync.");
  const result = await syncNbaCatalog({ db: getFirestore(), apiKey, logger: console.log });
  console.log(`NBA catalog sync completed: ${result.draftEligiblePlayerCount} Draft eligible / ${result.playerCount} retained players (${result.filteringStrategy}).`);
}
main().catch((error) => { console.error(`NBA catalog sync aborted: ${error.message}`); process.exitCode = 1; });
