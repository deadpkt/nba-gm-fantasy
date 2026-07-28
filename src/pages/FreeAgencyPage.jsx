import { useMemo, useState } from "react";
import FreeAgentFilters from "../components/freeAgency/FreeAgentFilters";
import FreeAgentList from "../components/freeAgency/FreeAgentList";
import PlayerInterestPanel from "../components/freeAgency/PlayerInterestPanel";
import PageLayout from "../components/PageLayout";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";

function FreeAgencyPage() {
  const { roster, leagueTeam } = useLeagueTeam();
  const { players, playersLoading, catalogEmpty, playersError } = usePlayers();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [filters, setFilters] = useState({ search: "", position: "ALL", rating: "all", sort: "overall" });
  const freeAgents = useMemo(() => players.filter((player) => player.availability === "free_agent"), [players]);
  const filteredAgents = useMemo(() => freeAgents.filter((player) => { const search = filters.search.trim().toLowerCase(); return (!search || `${player.name} ${player.position} ${player.team || ""}`.toLowerCase().includes(search)) && (filters.position === "ALL" || player.position === filters.position) && (filters.rating === "all" || player.overall >= Number(filters.rating)); }).toSorted((first, second) => filters.sort === "name" ? first.name.localeCompare(second.name) : filters.sort === "position" ? first.position.localeCompare(second.position) || second.overall - first.overall : second.overall - first.overall), [filters, freeAgents]);
  const availabilityUnavailable = !playersLoading && !catalogEmpty && !playersError && !players.some((player) => Object.hasOwn(player, "availability"));
  const rosterSpots = Math.max(0, 5 - roster.length);

  return <PageLayout><div className="free-agency-page">
    <section className="free-agency-hero"><div><p className="section-label">PLAYER MARKETPLACE</p><h1>Find your <span>edge.</span></h1><p>Scout the market, identify roster needs, and prepare your next move. Player signing remains unavailable until free-agency support is published.</p></div><div className="free-agency-hero__market"><span>MARKET STATUS</span><b>AWAITING AVAILABILITY</b><small>FREE-AGENT DATA REQUIRED</small></div></section>
    <section className="free-agency-team"><div className="free-agency-team__mark">{leagueTeam?.name?.slice(0, 2).toUpperCase() || "FC"}</div><div><span>YOUR FRANCHISE</span><b>{leagueTeam?.name || "Franchise setup"}</b><small>{roster.length}/5 roster spots filled</small></div><div><span>OPEN SPOTS</span><b>{rosterSpots}</b><small>{rosterSpots ? "Available roster spots" : "Starting five complete"}</small></div><div><span>TEAM NEEDS</span><b>Evaluation unavailable</b><small>Needs analysis has not been published.</small></div></section>
    <div className="free-agency-workspace"><section className="free-agency-market"><header><div><span>AVAILABLE PLAYERS</span><h2>Free agency <i>{playersLoading ? "Loading" : `${filteredAgents.length} available`}</i></h2></div></header><FreeAgentFilters filters={filters} onChange={setFilters} /><FreeAgentList players={filteredAgents} loading={playersLoading} unavailable={availabilityUnavailable || catalogEmpty || Boolean(playersError)} onView={setSelectedPlayer} /></section><PlayerInterestPanel player={selectedPlayer} /></div>
  </div></PageLayout>;
}

export default FreeAgencyPage;
