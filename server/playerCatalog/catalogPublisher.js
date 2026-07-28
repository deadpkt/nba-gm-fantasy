import { RATING_VERSION } from "../../src/lib/playerRatings.js";

export const CURRENT_CATALOG_PATH = "playerCatalogs/current";

// This produces a validated Firestore publish plan only. The publish function
// intentionally has no Firebase Admin dependency and performs no writes until
// a privileged Cloud Function or Cloud Run implementation is approved.
export function createCatalogPublication({
  players,
  source,
  season,
  ratingVersion = RATING_VERSION,
}) {
  if (!Array.isArray(players) || !players.length) {
    throw new Error("A catalog publication requires at least one player.");
  }
  if (typeof source !== "string" || !source.trim()) {
    throw new Error("A catalog source is required.");
  }
  if (typeof season !== "string" || !season.trim()) {
    throw new Error("A catalog season is required.");
  }

  const playerIds = new Set();
  const playerDocuments = players.map((player, catalogOrder) => {
    if (
      !Number.isInteger(player.id) ||
      player.id <= 0 ||
      playerIds.has(player.id)
    ) {
      throw new Error(
        `Catalog contains an invalid or duplicate NBA player ID: ${player.id}.`,
      );
    }
    playerIds.add(player.id);

    return {
      path: `${CURRENT_CATALOG_PATH}/players/${player.id}`,
      // catalogOrder is storage metadata and is removed by playerRepository
      // before a player reaches the UI or a saved league roster.
      data: { ...player, catalogOrder },
    };
  });

  return {
    catalogPath: CURRENT_CATALOG_PATH,
    catalogData: {
      id: "current",
      source: source.trim(),
      season: season.trim(),
      ratingVersion,
      playerCount: playerDocuments.length,
      // A real publisher replaces this marker with serverTimestamp().
      updatedAt: "SERVER_TIMESTAMP_ON_PUBLISH",
    },
    playerDocuments,
  };
}

export async function publishCatalog() {
  throw new Error(
    "Player catalog publishing is not configured. Add a privileged server-side publisher before enabling sync.",
  );
}
