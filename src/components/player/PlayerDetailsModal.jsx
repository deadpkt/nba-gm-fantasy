import { useEffect, useState } from "react";
import PlayerHeader from "./PlayerHeader";
import PlayerRatings from "./PlayerRatings";
import PlayerStats from "./PlayerStats";

export const openPlayerDetails = (player) => window.dispatchEvent(new CustomEvent("player-details:open", { detail: player }));
function PlayerDetailsModal() {
  const [player, setPlayer] = useState(null);
  useEffect(() => { const open = (event) => setPlayer(event.detail); window.addEventListener("player-details:open", open); return () => window.removeEventListener("player-details:open", open); }, []);
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === "Escape") setPlayer(null); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, []);
  if (!player) return null;
  return <div className="player-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPlayer(null); }}><section className="player-details-modal" role="dialog" aria-modal="true" aria-label={`${player.name} details`} style={{ "--player-accent": player.color || "#e32842" }}><button className="player-details__close" type="button" onClick={() => setPlayer(null)} aria-label="Close player details">×</button><PlayerHeader player={player} /><div className="player-details__content"><PlayerRatings player={player} /><PlayerStats player={player} /></div></section></div>;
}
export default PlayerDetailsModal;
