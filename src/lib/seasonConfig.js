export const SUPPORTED_LEAGUE_SIZES = Object.freeze([2, 4, 6, 8]);

export const SEASON_PRESET = Object.freeze({
  SHORT: "SHORT",
  STANDARD: "STANDARD",
  FULL: "FULL",
});

export const DEFAULT_SEASON_PRESET = SEASON_PRESET.STANDARD;
export const SCHEDULE_VERSION = 1;

const OPPONENT_CYCLES = Object.freeze({
  [SEASON_PRESET.SHORT]: 2,
  [SEASON_PRESET.STANDARD]: 4,
  [SEASON_PRESET.FULL]: 8,
});

export function deriveGamesPerTeam(maxMembers, preset) {
  if (!SUPPORTED_LEAGUE_SIZES.includes(maxMembers)) {
    throw new Error("League size must be 2, 4, 6, or 8 teams.");
  }
  const cycles = OPPONENT_CYCLES[preset];
  if (!cycles) throw new Error("Season length preset is not supported.");
  return (maxMembers - 1) * cycles;
}

export function createSeasonConfig(maxMembers, preset = DEFAULT_SEASON_PRESET) {
  return {
    preset,
    gamesPerTeam: deriveGamesPerTeam(maxMembers, preset),
    scheduleVersion: SCHEDULE_VERSION,
  };
}

export function normalizeSeasonConfig(maxMembers, seasonConfig) {
  try {
    const expected = createSeasonConfig(maxMembers, seasonConfig?.preset);
    if (
      seasonConfig?.gamesPerTeam === expected.gamesPerTeam &&
      seasonConfig?.scheduleVersion === SCHEDULE_VERSION
    ) {
      return expected;
    }
  } catch {
    // Legacy or invalid configuration falls through to the stable default.
  }
  return createSeasonConfig(maxMembers, DEFAULT_SEASON_PRESET);
}

export function getSeasonPresetLabel(preset) {
  return `${preset.charAt(0)}${preset.slice(1).toLowerCase()} Season`;
}

export function getSeasonPresetOptions(maxMembers) {
  return Object.values(SEASON_PRESET).map((preset) => ({
    preset,
    label: getSeasonPresetLabel(preset),
    gamesPerTeam: deriveGamesPerTeam(maxMembers, preset),
  }));
}
