import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { loadPlayerCatalog } from "../lib/playerRepository";

export const PlayersContext = createContext(null);

export function PlayersProvider({ children }) {
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState(null);
  const [catalogSource, setCatalogSource] = useState(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [validationDiagnostics, setValidationDiagnostics] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reloadPlayerCatalog = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setPlayersLoading(true);
      setPlayersError(null);
      try {
        const catalog = await loadPlayerCatalog();
        if (!active) return;

        setPlayers(catalog.players);
        setCatalogSource(catalog.source);
        setFallbackUsed(catalog.fallbackUsed);
        setCatalogEmpty(catalog.empty);
        setCatalogError(catalog.error);
        setValidationDiagnostics(catalog.diagnostics);
        // Existing consumers treat playersError as fatal. A recoverable
        // Firestore error must not block the validated local fallback.
        setPlayersError(catalog.empty ? catalog.error : null);
      } catch (error) {
        if (active) {
          console.error("Could not load player catalog:", error);
          setPlayers([]);
          setPlayersError(error);
          setCatalogSource(null);
          setFallbackUsed(false);
          setCatalogEmpty(true);
          setCatalogError(error);
          setValidationDiagnostics(null);
        }
      } finally {
        if (active) setPlayersLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const value = useMemo(
    () => ({
      players,
      playersLoading,
      playersError,
      loading: playersLoading,
      catalogSource,
      source: catalogSource,
      fallbackUsed,
      catalogEmpty,
      empty: catalogEmpty,
      catalogError,
      error: catalogError,
      validationDiagnostics,
      reloadPlayerCatalog,
    }),
    [
      players,
      playersLoading,
      playersError,
      catalogSource,
      fallbackUsed,
      catalogEmpty,
      catalogError,
      validationDiagnostics,
      reloadPlayerCatalog,
    ],
  );

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
}
