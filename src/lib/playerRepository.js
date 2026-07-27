import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import fallbackPlayers from "../data/players";
import { db, firebaseEnabled } from "./firebase";

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
  if (typeof player.image !== "string" || !player.image.trim())
    return invalid("missing-image");

  return { valid: true, player };
}

function validatePlayers(entries) {
  const diagnostics = emptyDiagnostics();
  const validEntries = [];

  entries.forEach(({ player, documentId, catalogOrder, index }) => {
    diagnostics.total += 1;
    const validation = validateCatalogPlayer(player, documentId);
    if (!validation.valid) {
      diagnostics.invalid.push({ id: String(documentId ?? player?.id ?? index), reason: validation.reason });
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
    throw catalogError("catalog-missing", "The published player catalog is missing.");
  }

  const playersSnapshot = await getDocs(
    collection(db, "playerCatalogs", "current", "players"),
  );
  if (playersSnapshot.empty) {
    return { players: [], diagnostics: emptyDiagnostics() };
  }

  return validatePlayers(
    playersSnapshot.docs.map((playerDocument, index) => {
      const { catalogOrder, ...player } = playerDocument.data();
      return { player, documentId: playerDocument.id, catalogOrder, index };
    }),
  );
}

function fallbackResult(error, firestoreDiagnostics = emptyDiagnostics()) {
  const fallback = validatePlayers(
    fallbackPlayers.map((player, index) => ({
      player,
      documentId: String(player.id),
      catalogOrder: index,
      index,
    })),
  );

  return {
    players: fallback.players,
    source: "fallback",
    fallbackUsed: true,
    empty: fallback.players.length === 0,
    error,
    diagnostics: { firestore: firestoreDiagnostics, fallback: fallback.diagnostics },
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
        diagnostics: { firestore: firestore.diagnostics, fallback: emptyDiagnostics() },
      };
    }

    return fallbackResult(
      catalogError("catalog-empty", "The Firestore player catalog has no valid players."),
      firestore.diagnostics,
    );
  } catch (error) {
    return fallbackResult(error);
  }
}
