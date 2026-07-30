import { useMemo, useState } from "react";
import { PlayersProvider } from "../context/PlayersContext";
import useFreeAgencyOwnership from "../hooks/useFreeAgencyOwnership";
import useLeague from "../hooks/useLeague";
import usePlayers from "../hooks/usePlayers";
import { canBuildLegalStartingFive } from "../lib/lineupFeasibility";
import { repairPreseasonRoster } from "../lib/preseasonRosterRepair";
import PlayerCard from "./PlayerCard";

function RepairContent({ roster, onClose }) {
  const { activeLeagueId } = useLeague();
  const { players, playersLoading, playersError } = usePlayers();
  const { ownedPlayerIds, ownershipLoading, ownershipError } = useFreeAgencyOwnership();
  const [dropPlayerId, setDropPlayerId] = useState(roster[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [busyPlayerId, setBusyPlayerId] = useState(null);
  const [error, setError] = useState("");
  const candidates = useMemo(() => players.filter((player) => {
    if (ownedPlayerIds.has(String(player.id))) return false;
    if (search && !`${player.name} ${player.team || ""} ${(player.eligiblePositions || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
    const nextRoster = roster.map((current) => String(current.id) === String(dropPlayerId) ? player : current);
    return canBuildLegalStartingFive(nextRoster).valid;
  }), [dropPlayerId, ownedPlayerIds, players, roster, search]);

  async function replace(player) {
    setBusyPlayerId(player.id);
    setError("");
    try {
      await repairPreseasonRoster({ leagueId: activeLeagueId, dropPlayerId, addPlayerId: player.id });
      onClose();
    } catch (actionError) {
      setError(actionError.message || "The roster could not be repaired.");
    } finally {
      setBusyPlayerId(null);
    }
  }

  return <div className="player-details-backdrop" role="presentation"><section className="roster-repair-modal" role="dialog" aria-modal="true" aria-labelledby="repair-title"><header><div><p className="section-label">PRE-SEASON INTEGRITY REPAIR</p><h2 id="repair-title">Fix Roster Composition</h2><p>Choose one player to replace. Only replacements that create a legal PG/SG/SF/PF/C Starting Five are shown.</p></div><button type="button" onClick={onClose} aria-label="Close roster repair">×</button></header><div className="roster-repair-controls"><label>PLAYER OUT<select value={dropPlayerId} onChange={(event) => setDropPlayerId(event.target.value)}>{roster.map((player) => <option key={player.id} value={player.id}>{player.name} · {(player.eligiblePositions || [player.position]).join("/")}</option>)}</select></label><label>SEARCH REPLACEMENTS<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, team, or position" /></label></div>{(error || ownershipError) && <p className="official-game-error" role="alert">{error || ownershipError}</p>}{playersLoading || ownershipLoading ? <div className="route-loader">Finding legal replacements...</div> : playersError ? <p className="empty-state">The canonical player catalog is unavailable.</p> : candidates.length ? <div className="roster-repair-grid">{candidates.slice(0, 48).map((player) => <PlayerCard key={player.id} player={player} onAction={replace} disabled={busyPlayerId !== null} actionLabel={String(busyPlayerId) === String(player.id) ? "Replacing..." : "Replace Player"} />)}</div> : <p className="empty-state">No unowned replacement matching this search creates a legal Starting Five.</p>}</section></div>;
}

export default function PreseasonRosterRepair(props) {
  return <PlayersProvider><RepairContent {...props} /></PlayersProvider>;
}
