import { createBalldontlieClient, probeProviderCapabilities } from "../functions/lib/balldontlie.js";
import { loadLocalEnv } from "./lib/loadLocalEnv.mjs";

loadLocalEnv();

async function main() {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) {
    console.log("BALLDONTLIE_API_KEY is not configured. Connectivity test skipped without exposing a client secret.");
    return;
  }
  const capabilities = await probeProviderCapabilities(createBalldontlieClient({ apiKey: key }));
  console.log("BALLDONTLIE connectivity succeeded.");
  console.log(`Players directory: ${capabilities.players ? "AVAILABLE" : "UNAVAILABLE"}`);
  console.log(`Active Players: ${capabilities.activePlayers ? "AVAILABLE" : "TIER UNAVAILABLE"}`);
  console.log(`Game Player Stats: ${capabilities.enrichedStats ? "AVAILABLE" : "TIER UNAVAILABLE"}`);
}
main().catch((error) => { console.error(`BALLDONTLIE connectivity failed: ${error.message}`); process.exitCode = 1; });
