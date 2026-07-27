// This module is deliberately not connected to the catalog or simulation yet.
// A future server-side NBA data adapter should normalize provider statistics to
// this input shape, calculate an overall, and publish a new catalog version.
// Existing league rosters are player snapshots, so they keep their saved
// overall values even after later catalog versions use a newer formula.

export const RATING_VERSION = "nba-stats-v1";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const numberOrZero = (value) => (Number.isFinite(value) ? value : 0);

// Converts a stat to a 0-1 score within a documented expected NBA range.
// Values outside the range are clamped instead of allowing outliers to skew
// ratings beyond the configured 60-99 overall scale.
export function normalizeRange(value, minimum, maximum) {
  if (!Number.isFinite(value) || maximum <= minimum) return 0;
  return clamp((value - minimum) / (maximum - minimum), 0, 1);
}

export function normalizePercentage(value) {
  // Accepts either a decimal (0.615) or percentage (61.5).
  const decimal = numberOrZero(value) > 1 ? numberOrZero(value) / 100 : numberOrZero(value);
  return normalizeRange(decimal, 0.45, 0.7);
}

const positionGroup = (position) => {
  if (["PG", "SG"].includes(position)) return "guard";
  if (["PF", "C"].includes(position)) return "big";
  return "wing";
};

const FORMULAS = {
  [RATING_VERSION]: {
    minimumOverall: 60,
    maximumOverall: 99,
    weights: {
      guard: {
        scoring: 0.27,
        playmaking: 0.25,
        efficiency: 0.18,
        defense: 0.1,
        rebounding: 0.04,
        availability: 0.08,
        ballSecurity: 0.08,
      },
      wing: {
        scoring: 0.28,
        playmaking: 0.16,
        efficiency: 0.18,
        defense: 0.16,
        rebounding: 0.08,
        availability: 0.08,
        ballSecurity: 0.06,
      },
      big: {
        scoring: 0.24,
        playmaking: 0.1,
        efficiency: 0.18,
        defense: 0.2,
        rebounding: 0.16,
        availability: 0.08,
        ballSecurity: 0.04,
      },
    },
  },
};

export const RATING_FORMULAS = FORMULAS;

// Expected input is normalized NBA season data. Per-game fields avoid giving
// players with more games a raw-volume advantage; availability is scored
// separately from games played and minutes.
export function calculateRatingBreakdown(
  stats = {},
  position = "SF",
  version = RATING_VERSION,
) {
  const formula = FORMULAS[version];
  if (!formula) throw new Error(`Unknown player rating version: ${version}`);

  const components = {
    scoring: normalizeRange(numberOrZero(stats.points), 4, 35),
    playmaking: normalizeRange(numberOrZero(stats.assists), 0.5, 12),
    efficiency: normalizePercentage(stats.trueShootingPercentage),
    defense: clamp(
      normalizeRange(numberOrZero(stats.steals), 0, 2.5) * 0.45 +
        normalizeRange(numberOrZero(stats.blocks), 0, 3.5) * 0.55,
      0,
      1,
    ),
    rebounding: normalizeRange(numberOrZero(stats.rebounds), 1, 15),
    availability: clamp(
      normalizeRange(numberOrZero(stats.gamesPlayed), 10, 82) * 0.55 +
        normalizeRange(numberOrZero(stats.minutesPlayed), 250, 2800) * 0.45,
      0,
      1,
    ),
    // Fewer turnovers produces a higher ball-security component.
    ballSecurity: 1 - normalizeRange(numberOrZero(stats.turnovers), 0.5, 5),
  };

  const weights = formula.weights[positionGroup(position)];
  const weightedScore = Object.entries(weights).reduce(
    (total, [component, weight]) => total + components[component] * weight,
    0,
  );
  const overall = Math.round(
    formula.minimumOverall +
      weightedScore * (formula.maximumOverall - formula.minimumOverall),
  );

  return {
    version,
    positionGroup: positionGroup(position),
    components,
    weightedScore,
    overall: clamp(overall, formula.minimumOverall, formula.maximumOverall),
  };
}

export function calculateOverall(stats, position, version = RATING_VERSION) {
  return calculateRatingBreakdown(stats, position, version).overall;
}
