const SOURCE_URL =
  "https://gist.githubusercontent.com/justcodeAI/54170eb521eb422f67440690a9b6bd66/raw/nba-players-complete-2024-25.json";
import { writeFile } from "node:fs/promises";
const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "nba-gm-fantasy-catalog-maintenance" },
});
if (!response.ok)
  throw new Error(`Headshot identity source returned HTTP ${response.status}.`);
const payload = await response.json();
const players = Array.isArray(payload?.players) ? payload.players : [];
const entries = players
  .filter(
    (player) => /^\d+$/.test(String(player.player_id)) && player.full_name,
  )
  .map((player) => ({
    name: player.full_name,
    nbaPlayerId: String(player.player_id),
    team: player.team_code || null,
  }))
  .sort((first, second) => first.name.localeCompare(second.name));
if (entries.length < 400 || entries.length > 700)
  throw new Error(`Refusing implausible headshot map size ${entries.length}.`);
const snapshot = JSON.stringify(
  {
    version: "nba-com-roster-2025-07-21",
    source: "NBA.com league roster snapshot",
    sourceUrl: SOURCE_URL,
    capturedAt: "2025-07-21",
    entries,
  },
  null,
  2,
);
if (process.argv.includes("--write")) {
  await writeFile(
    new URL("../../functions/data/nbaHeadshotIds.json", import.meta.url),
    `${snapshot}\n`,
    "utf8",
  );
  console.log(`Wrote ${entries.length} verified NBA headshot identities.`);
} else {
  process.stdout.write(snapshot);
}
