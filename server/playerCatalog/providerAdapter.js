import { calculateOverall, RATING_VERSION } from "../../src/lib/playerRatings.js";

const REQUIRED_POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);

const requireText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Provider player is missing ${field}.`);
  }
  return value.trim();
};

const requireNbaPlayerId = (value) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Provider player is missing a valid NBA player ID.");
  }
  return value;
};

const requiredStat = (stats, field) => {
  if (!Number.isFinite(stats?.[field])) {
    throw new Error(`Provider player is missing a valid ${field} stat.`);
  }
  return stats[field];
};

const headshotUrl = (nbaPlayerId) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`;

// Future provider adapters should map their response to this input shape before
// calling normalizeProviderPlayer. This keeps vendor IDs and field names out of
// the client player contract and protects the existing NBA numeric IDs.
//
// {
//   nbaPlayerId, fullName, primaryPosition, teamAbbreviation,
//   seasonStats: { points, rebounds, assists, ...rating inputs }
// }
export function normalizeProviderPlayer(providerPlayer, options = {}) {
  const id = requireNbaPlayerId(providerPlayer?.nbaPlayerId);
  const position = requireText(providerPlayer?.primaryPosition, "primaryPosition");
  if (!REQUIRED_POSITIONS.has(position)) {
    throw new Error(`Provider player has an unsupported primary position: ${position}.`);
  }

  const seasonStats = providerPlayer?.seasonStats;
  const stats = {
    points: requiredStat(seasonStats, "points"),
    rebounds: requiredStat(seasonStats, "rebounds"),
    assists: requiredStat(seasonStats, "assists"),
  };
  const ratingVersion = options.ratingVersion || RATING_VERSION;

  // overall is computed here, not supplied by the provider. The current app
  // does not invoke this module, so existing manual ratings remain unchanged.
  return {
    id,
    name: requireText(providerPlayer?.fullName, "fullName"),
    position,
    team: requireText(providerPlayer?.teamAbbreviation, "teamAbbreviation"),
    stats,
    overall: calculateOverall(seasonStats, position, ratingVersion),
    image: headshotUrl(id),
  };
}

export function createProviderAdapter({ providerName, toCanonicalPlayer }) {
  if (typeof providerName !== "string" || !providerName.trim()) {
    throw new Error("A provider name is required.");
  }
  if (typeof toCanonicalPlayer !== "function") {
    throw new Error("A provider player mapping function is required.");
  }

  return {
    providerName: providerName.trim(),
    normalize(record, options) {
      return normalizeProviderPlayer(toCanonicalPlayer(record), options);
    },
  };
}
