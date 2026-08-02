const finiteOrNull = (value) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
export const clampRating = (value) => Math.max(25, Math.min(99, Math.round(value)));

export function winsorizedValues(rows, selector, lower = .02, upper = .98) {
  const values = rows.map(selector).map(finiteOrNull).filter((value) => value !== null).toSorted((a, b) => a - b);
  if (!values.length) return { values, low: null, high: null };
  const at = (percentile) => values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * percentile)))];
  return { values, low: at(lower), high: at(upper) };
}

export function percentileRank(value, distribution) {
  const number = finiteOrNull(value);
  if (number === null || !distribution?.values?.length) return null;
  const bounded = Math.max(distribution.low, Math.min(distribution.high, number));
  let below = 0;
  let equal = 0;
  for (const candidate of distribution.values) {
    if (candidate < bounded) below += 1;
    else if (candidate === bounded) equal += 1;
  }
  return (below + Math.max(0, equal - 1) / 2) / Math.max(1, distribution.values.length - 1);
}

export function buildPopulationNormalizer(rows, selectors) {
  const global = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, winsorizedValues(rows, selector)]));
  const positions = {};
  for (const position of ["PG", "SG", "SF", "PF", "C"]) {
    const scoped = rows.filter((row) => (row.player.eligiblePositions || [row.player.primaryPosition]).includes(position));
    positions[position] = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, winsorizedValues(scoped, selector)]));
  }
  return {
    metadata: Object.fromEntries(Object.entries(global).map(([key, value]) => [key, { samples: value.values.length, low: value.low, high: value.high }])),
    rank(key, value, eligiblePositions = []) {
      const globalRank = percentileRank(value, global[key]);
      if (globalRank === null) return null;
      const positional = eligiblePositions.map((position) => percentileRank(value, positions[position]?.[key])).filter((rank) => rank !== null);
      if (!positional.length) return globalRank;
      return globalRank * .7 + Math.max(...positional) * .3;
    },
  };
}

export function percentileToRating(percentile) {
  if (percentile === null || percentile === undefined) return null;
  return clampRating(42 + 55 * Math.max(0, Math.min(1, percentile)));
}

export function percentileToRatingElite(percentile) {
  if (percentile === null || percentile === undefined) return null;
  const bounded = Math.max(0, Math.min(1, percentile));
  const base = 42 + 55 * bounded;
  if (bounded <= .85) return clampRating(base);
  const upperTail = (bounded - .85) / .15;
  return clampRating(base + 2.8 * upperTail ** 2);
}
