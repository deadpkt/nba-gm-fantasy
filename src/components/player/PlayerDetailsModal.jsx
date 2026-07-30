import { useEffect, useState } from "react";
import PlayerHeader from "./PlayerHeader";
import PlayerRatings from "./PlayerRatings";
import PlayerStats from "./PlayerStats";
import { isCanonicalCatalogPlayer } from "../../lib/playerCatalog";
import { loadCatalogPlayerById } from "../../lib/playerRepository";

export const openPlayerDetails = (player) =>
  window.dispatchEvent(
    new CustomEvent("player-details:open", { detail: player }),
  );
function PlayerDetailsModal() {
  const [requestedPlayer, setRequestedPlayer] = useState(null);
  const [canonicalPlayer, setCanonicalPlayer] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsUnavailable, setDetailsUnavailable] = useState(false);
  const requestedSnapshot = requestedPlayer && typeof requestedPlayer === "object" ? requestedPlayer : null;
  const requestedPlayerId = requestedSnapshot?.id ?? requestedPlayer;
  const player = canonicalPlayer || requestedSnapshot;
  useEffect(() => {
    const open = (event) => setRequestedPlayer(event.detail);
    window.addEventListener("player-details:open", open);
    return () => window.removeEventListener("player-details:open", open);
  }, []);
  useEffect(() => {
    setCanonicalPlayer(null);
    setDetailsUnavailable(false);
    if (!requestedPlayerId || isCanonicalCatalogPlayer(requestedSnapshot)) {
      setDetailsLoading(false);
      return undefined;
    }

    let active = true;
    setDetailsLoading(true);
    void loadCatalogPlayerById(requestedPlayerId)
      .then((catalogPlayer) => {
        if (!active) return;
        setCanonicalPlayer(catalogPlayer);
        setDetailsUnavailable(!catalogPlayer);
      })
      .catch(() => {
        if (active) setDetailsUnavailable(true);
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedPlayerId, requestedSnapshot]);
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setRequestedPlayer(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  if (!requestedPlayer) return null;
  return (
    <div
      className="player-details-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setRequestedPlayer(null);
      }}
    >
      <section
        className="player-details-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${player?.name || "Player"} details`}
        style={{ "--player-accent": player?.color || "#e32842" }}
      >
        <button
          className="player-details__close"
          type="button"
          onClick={() => setRequestedPlayer(null)}
          aria-label="Close player details"
        >
          ×
        </button>
        {player ? (
          <>
            <PlayerHeader player={player} />
            {detailsLoading && <p className="player-stats__unavailable">Checking for current catalog details...</p>}
            {detailsUnavailable && <p className="player-stats__unavailable">Current catalog details are unavailable. Showing the saved player snapshot.</p>}
            <div className="player-details__content">
              <PlayerRatings player={player} />
              <PlayerStats player={player} />
            </div>
          </>
        ) : (
          <p className="player-stats__unavailable">{detailsLoading ? "Loading player details..." : "Player details are unavailable."}</p>
        )}
      </section>
    </div>
  );
}
export default PlayerDetailsModal;
