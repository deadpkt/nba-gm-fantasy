const median = (values) => values.length ? values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
const rankMap = (rows, key) => new Map([...rows].toSorted((a, b) => b[key] - a[key] || String(a.playerId).localeCompare(String(b.playerId))).map((row, index) => [String(row.playerId), index + 1]));

export function compareOptionalRatingBenchmark(players = [], benchmark = []) {
  const source = new Map(benchmark.filter((row) => row?.playerId && Number.isFinite(row.benchmarkOverall)).map((row) => [String(row.playerId), row]));
  const matched = players.filter((player) => source.has(String(player.playerId))).map((player) => ({ playerId: player.playerId, name: player.name, overall: player.overall, benchmarkOverall: source.get(String(player.playerId)).benchmarkOverall, delta: player.overall - source.get(String(player.playerId)).benchmarkOverall, tier: player.calibrationProfile?.tier, benchmarkSource: source.get(String(player.playerId)).benchmarkSource, benchmarkSeason: source.get(String(player.playerId)).benchmarkSeason }));
  const absolute = matched.map((row) => Math.abs(row.delta));
  const ownRanks = rankMap(matched, "overall"), benchmarkRanks = rankMap(matched, "benchmarkOverall");
  const rankCorrelation = matched.length > 1 ? 1 - 6 * matched.reduce((sum, row) => sum + (ownRanks.get(String(row.playerId)) - benchmarkRanks.get(String(row.playerId))) ** 2, 0) / (matched.length * (matched.length ** 2 - 1)) : null;
  return { matchedCount: matched.length, meanAbsoluteDifference: matched.length ? absolute.reduce((sum, value) => sum + value, 0) / matched.length : 0, medianAbsoluteDifference: median(absolute), rankCorrelation, largestPositiveGaps: [...matched].toSorted((a, b) => b.delta - a.delta).slice(0, 20), largestNegativeGaps: [...matched].toSorted((a, b) => a.delta - b.delta).slice(0, 20), tierAgreement: matched.length ? matched.filter((row) => Math.abs(row.delta) <= 4).length / matched.length : 0 };
}
