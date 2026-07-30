import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { dedupeCatalogPlayers, isCanonicalCatalogPlayer, RUNTIME_PLAYER_CATALOG_SOURCE } from "./playerCatalog";
import { resolvePlayerHeadshot } from "./playerHeadshots";

const catalogRef = () => doc(db, "playerCatalogs", "current");

const emptyDiagnostics = () => ({ total: 0, valid: 0, invalid: [] });

const catalogError = (code, message, cause) => {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
};

export function validateCatalogPlayer(player, documentId) {
  const invalid = (reason) => ({ valid: false, reason });

  if (!player || typeof player !== "object") return invalid("not-an-object");
  if (player.id === undefined || player.id === null || player.id === "")
    return invalid("missing-id");
  if (documentId && String(player.id) !== String(documentId))
    return invalid("id-does-not-match-document");
  if (typeof player.name !== "string" || !player.name.trim())
    return invalid("missing-name");
  if (typeof player.position !== "string" || !player.position.trim())
    return invalid("missing-position");
  if (typeof player.team !== "string" || !player.team.trim())
    return invalid("missing-team");
  if (!player.stats || typeof player.stats !== "object")
    return invalid("missing-stats");
  if (
    !Number.isFinite(player.stats.points) ||
    !Number.isFinite(player.stats.rebounds) ||
    !Number.isFinite(player.stats.assists)
  ) {
    return invalid("invalid-stats");
  }
  if (!Number.isFinite(player.overall)) return invalid("invalid-overall");
  if (typeof player.primaryPosition !== "string" || !player.primaryPosition)
    return invalid("missing-primary-position");
  if (!Array.isArray(player.eligiblePositions) || !player.eligiblePositions.length)
    return invalid("missing-eligible-positions");
  const imageUrl = resolvePlayerHeadshot(player);
  return { valid: true, player: { ...player, imageUrl, image: imageUrl } };
}

export async function loadCatalogPlayerById(playerId) {
  if (playerId === undefined || playerId === null || playerId === "") return null;
  if (!firebaseEnabled || !db) return null;
  const playerDocument = await getDoc(
    doc(db, "playerCatalogs", "current", "players", String(playerId)),
  );
  if (!playerDocument.exists()) return null;
  const { catalogOrder: _catalogOrder, ...player } = playerDocument.data();
  const validation = validateCatalogPlayer(player, playerDocument.id);
  return validation.valid ? validation.player : null;
}

function validatePlayers(entries) {
  const diagnostics = emptyDiagnostics();
  const validEntries = [];

  entries.forEach(({ player, documentId, catalogOrder, index }) => {
    diagnostics.total += 1;
    const validation = validateCatalogPlayer(player, documentId);
    if (!validation.valid) {
      diagnostics.invalid.push({
        id: String(documentId ?? player?.id ?? index),
        reason: validation.reason,
      });
      return;
    }

    diagnostics.valid += 1;
    validEntries.push({
      player: validation.player,
      catalogOrder: Number.isInteger(catalogOrder) ? catalogOrder : null,
      index,
    });
  });

  validEntries.sort((first, second) => {
    if (first.catalogOrder !== null && second.catalogOrder !== null)
      return first.catalogOrder - second.catalogOrder;
    if (first.catalogOrder !== null) return -1;
    if (second.catalogOrder !== null) return 1;
    return first.index - second.index;
  });

  return { players: validEntries.map((entry) => entry.player), diagnostics };
}

async function loadFirestorePlayerCatalog() {
  if (!firebaseEnabled || !db) {
    throw catalogError("firebase-unavailable", "Firebase is not configured.");
  }

  const currentCatalog = await getDoc(catalogRef());
  if (!currentCatalog.exists()) {
    throw catalogError(
      "catalog-missing",
      "The published player catalog is missing.",
    );
  }

  const playersSnapshot = await getDocs(
    query(
      collection(db, "playerCatalogs", "current", "players"),
      where("active", "==", true),
      where("draftEligible", "==", true),
    ),
  );
  if (playersSnapshot.empty) {
    return { players: [], diagnostics: emptyDiagnostics(), metadata: currentCatalog.data() };
  }

  const validated = validatePlayers(
    playersSnapshot.docs.map((playerDocument, index) => {
      const { catalogOrder, ...player } = playerDocument.data();
      return { player, documentId: playerDocument.id, catalogOrder, index };
    }),
  );
  return { ...validated, players: dedupeCatalogPlayers(validated.players.filter(isCanonicalCatalogPlayer)), metadata: currentCatalog.data() };
}

function unavailableResult(error, firestoreDiagnostics = emptyDiagnostics()) {
  return {
    players: [],
    source: RUNTIME_PLAYER_CATALOG_SOURCE,
    fallbackUsed: false,
    empty: true,
    error,
    diagnostics: {
      firestore: firestoreDiagnostics,
      fallback: emptyDiagnostics(),
    },
  };
}

// This is the only data-source adapter used by the player provider. A future
// NBA API adapter can be added here without changing roster or UI contracts.
export async function loadPlayerCatalog() {
  try {
    const firestore = await loadFirestorePlayerCatalog();
    if (firestore.players.length) {
      return {
        players: firestore.players,
        source: "firestore",
        fallbackUsed: false,
        empty: false,
        error: null,
        diagnostics: {
          firestore: firestore.diagnostics,
          fallback: emptyDiagnostics(),
        },
        metadata: firestore.metadata,
      };
    }

    return unavailableResult(
      catalogError(
        "catalog-empty",
        "The Firestore player catalog has no valid players.",
      ),
      firestore.diagnostics,
    );
  } catch (error) {
    return unavailableResult(error);
  }
}
