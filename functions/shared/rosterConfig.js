export const STARTER_COUNT = 5;
export const LEGACY_ROSTER_SIZE = 5;
export const ROSTER_SIZE = 8;
export const BENCH_SIZE = 3;
export const LEGACY_SALARY_CAP = 100_000_000;
export const SALARY_CAP = 140_000_000;
export function normalizeRosterConfig(league = {}) {
  const config = league?.rosterConfig;
  return config?.version === 2 && config.rosterSize === 8 && config.starterCount === 5 && config.benchSize === 3
    ? { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 }
    : { version: 1, rosterSize: 5, starterCount: 5, benchSize: 0 };
}
export const getLeagueSalaryCap = (league = {}) => normalizeRosterConfig(league).version === 2 ? SALARY_CAP : LEGACY_SALARY_CAP;
