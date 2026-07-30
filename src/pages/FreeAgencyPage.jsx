import { useMemo, useState } from "react";
import { PlayersProvider } from "../context/PlayersContext";
import FreeAgentFilters from "../components/freeAgency/FreeAgentFilters";
import FreeAgentList from "../components/freeAgency/FreeAgentList";
import PageLayout from "../components/PageLayout";
import { openPlayerDetails } from "../components/player/PlayerDetailsModal";
import useLeague from "../hooks/useLeague";
import useLeagueContracts from "../hooks/useLeagueContracts";
import useLeagueTeam from "../hooks/useLeagueTeam";
import useFreeAgencyOwnership from "../hooks/useFreeAgencyOwnership";
import usePlayers from "../hooks/usePlayers";
import { formatMoney, getInitialSalary, INITIAL_CONTRACT_YEARS } from "../lib/contracts";
import { signFreeAgent } from "../lib/freeAgency";
import { filterUnownedPlayers } from "../lib/freeAgencyPool";
import { getRosterCapacity } from "../lib/rosterConfig";

const PAGE_SIZE = 48;

function FreeAgencyContent() {
  const { roster, leagueTeam } = useLeagueTeam();
  const { activeLeague, activeLeagueId } = useLeague();
  const { players, playersLoading, playersError, catalogEmpty } = usePlayers();
  const { ownedPlayerIds, ownershipLoading, ownershipError } = useFreeAgencyOwnership();
  const { payroll, capSpace, salaryCap, contractsLoading } = useLeagueContracts();
  const capacity = getRosterCapacity(activeLeague, roster);
  const [filters, setFilters] = useState({ search: "", position: "ALL", rating: "all", sort: "overall" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [signingPlayerId, setSigningPlayerId] = useState(null);
  const [actionError, setActionError] = useState("");
  const freeAgents = useMemo(() => filterUnownedPlayers(players, ownedPlayerIds), [ownedPlayerIds, players]);
  const filteredAgents = useMemo(() => freeAgents.filter((player) => {
    const search = filters.search.trim().toLowerCase();
    const positions = player.eligiblePositions || [player.primaryPosition || player.position];
    return (!search || `${player.name} ${player.team || ""} ${positions.join(" ")}`.toLowerCase().includes(search))
      && (filters.position === "ALL" || positions.includes(filters.position))
      && (filters.rating === "all" || player.overall >= Number(filters.rating));
  }).toSorted((first, second) => {
    if (filters.sort === "name") return first.name.localeCompare(second.name);
    if (filters.sort === "position") return (first.primaryPosition || first.position).localeCompare(second.primaryPosition || second.position) || second.overall - first.overall;
    if (filters.sort === "salary") return getInitialSalary(second.overall) - getInitialSalary(first.overall) || second.overall - first.overall;
    return second.overall - first.overall || first.name.localeCompare(second.name);
  }), [filters, freeAgents]);
  const contractFor = (player) => ({ salary: getInitialSalary(player.overall), yearsRemaining: INITIAL_CONTRACT_YEARS });
  const disabledReasonFor = (player) => capacity.openRosterSlots === 0 ? "Roster full" : getInitialSalary(player.overall) > capSpace ? "Over cap" : "";

  async function sign(player) {
    setSigningPlayerId(player.id);
    setActionError("");
    try { await signFreeAgent({ leagueId: activeLeagueId, playerId: player.id }); }
    catch (error) { setActionError(error.message || "Player could not be signed."); }
    finally { setSigningPlayerId(null); }
  }

  return <PageLayout><div className="free-agency-page">
    <section className="free-agency-hero"><div><p className="section-label">SEASON {activeLeague?.offseason?.nextSeason} OFFSEASON</p><h1>Free <span>agency.</span></h1><p>Sign unowned canonical NBA players or reshape your roster. All contracts and ownership changes are trusted and league-scoped.</p></div><div className="free-agency-hero__market"><span>MARKET STATUS</span><b>OPEN</b><small>OFFSEASON ACQUISITIONS</small></div></section>
    <section className="free-agency-team"><div className="free-agency-team__mark">{leagueTeam?.name?.slice(0, 2).toUpperCase() || "FC"}</div><div><span>YOUR FRANCHISE</span><b>{leagueTeam?.name || "Franchise setup"}</b><small>Roster {capacity.currentRosterCount} / {capacity.rosterSize}</small></div><div><span>PAYROLL / CAP</span><b>{contractsLoading ? "Loading" : `${formatMoney(payroll)} / ${formatMoney(salaryCap)}`}</b><small>Cap space {formatMoney(capSpace)}</small></div><div><span>OPEN ROSTER SPOTS</span><b>{capacity.openRosterSlots}</b><small>{capacity.openRosterSlots ? "Sign available players below" : "Release someone before signing"}</small></div></section>
    {(actionError || ownershipError) && <p className="official-game-error" role="alert">{actionError || ownershipError}</p>}
    <section className="free-agency-market"><header><div><span>AVAILABLE FREE AGENTS</span><h2>Player market <i>{freeAgents.length} available</i></h2></div></header><FreeAgentFilters filters={filters} onChange={(next) => { setFilters(next); setVisibleCount(PAGE_SIZE); }} /><FreeAgentList players={filteredAgents.slice(0, visibleCount)} loading={playersLoading || ownershipLoading} unavailable={catalogEmpty || Boolean(playersError || ownershipError)} onView={openPlayerDetails} onSign={sign} signingPlayerId={signingPlayerId} contractFor={contractFor} disabledReasonFor={disabledReasonFor} />{visibleCount < filteredAgents.length && <button className="button-secondary free-agency-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load More</button>}</section>
  </div></PageLayout>;
}

function FreeAgencyPage() {
  return <PlayersProvider><FreeAgencyContent /></PlayersProvider>;
}

export default FreeAgencyPage;
