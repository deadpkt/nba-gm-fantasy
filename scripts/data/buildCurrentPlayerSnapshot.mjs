const SOURCE_URL = "https://www.basketball-reference.com/leagues/NBA_2026_per_game.html";

const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`Snapshot source returned HTTP ${response.status}.`);
const html = await response.text();
const MIN_GAMES = 5;
const names = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
  .map((rowMatch) => rowMatch[1])
  .map((row) => ({
    name: row.match(/data-stat="name_display"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/)?.[1],
    games: Number(row.match(/data-stat="games"[^>]*>(\d+)<\/td>/)?.[1] || 0),
  }))
  .filter((player) => player.name && player.games >= MIN_GAMES)
  .map((player) => player.name.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").trim());
const uniqueNames = [...new Set(names)].sort((first, second) => first.localeCompare(second));
if (uniqueNames.length < 350 || uniqueNames.length > 700) {
  throw new Error(`Refusing to create an implausible snapshot with ${uniqueNames.length} players.`);
}
process.stdout.write(JSON.stringify({
  season: "2025-26",
  strategy: `current-season-${MIN_GAMES}-game-appearance-allowlist`,
  source: SOURCE_URL,
  capturedAt: new Date().toISOString().slice(0, 10),
  names: uniqueNames,
}, null, 2));
