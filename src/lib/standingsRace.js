export function gamesBehind(leader, row) {
  if (!leader || !row || leader.teamUid === row.teamUid) return 0;
  return ((leader.wins - row.wins) + (row.losses - leader.losses)) / 2;
}

export function formatGamesBehind(value, leader = false) {
  if (leader) return "—";
  const normalized = Math.max(0, Number(value) || 0);
  return Number.isInteger(normalized) ? normalized.toFixed(1) : String(normalized);
}

export function deriveRaceInsight(rows = [], qualifierCount, currentUid) {
  if (rows.length < 2 || rows.every((row) => row.gp === 0) || !Number.isInteger(qualifierCount)) return "";
  const tied = new Map();
  rows.forEach((row) => {
    const key = `${row.wins}-${row.losses}`;
    tied.set(key, [...(tied.get(key) || []), row]);
  });
  const largestTie = [...tied.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (largestTie?.[1].length >= 2) return `${largestTie[1].length} franchises are tied at ${largestTie[0]}.`;

  const current = rows.find((row) => row.teamUid === currentUid);
  const firstOut = rows[qualifierCount];
  if (current && firstOut && current.rank <= qualifierCount) {
    const margin = Math.max(0, gamesBehind(rows[0], firstOut) - gamesBehind(rows[0], current));
    if (margin > 0) return `${current.teamName} ${margin === 0.5 ? "hold a half-game" : `are ${formatGamesBehind(margin) } games`} above the playoff line.`;
  }

  const leaders = rows.slice(0, Math.min(3, rows.length));
  const spread = gamesBehind(rows[0], leaders.at(-1));
  if (leaders.length >= 3 && spread <= 1) return `${formatGamesBehind(spread)} game${spread === 1 ? "" : "s"} separate seeds #1–#${leaders.length}.`;
  return "";
}
import { isOfficialGameFinalVisible } from "./officialGamePresentation.js";

export function visibleStandingsGames(games = [], now = Date.now()) {
  return games.filter((game) => isOfficialGameFinalVisible(game, now));
}
