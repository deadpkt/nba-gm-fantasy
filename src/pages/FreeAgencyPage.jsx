import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { filterAndSortFreeAgents, getMarketStatus, getPlayerSigningState } from "../lib/freeAgencyPresentation";
import { getRosterCapacity } from "../lib/rosterConfig";
import { getUserFriendlyError } from "../lib/clientErrors";
import "../freeAgency.css";

const PAGE_SIZE = 48;
const DEFAULT_FILTERS = { search: "", position: "ALL", sort: "overall" };

function FreeAgencyContent() {
  const { roster, leagueTeam } = useLeagueTeam();
  const { activeLeague, activeLeagueId } = useLeague();
  const { players, playersLoading, playersError, catalogEmpty } = usePlayers();
  const { ownedPlayerIds, ownershipLoading, ownershipError } = useFreeAgencyOwnership();
  const { payroll, capSpace, salaryCap, contractsLoading, contractsError } = useLeagueContracts();
  const capacity = getRosterCapacity(activeLeague, roster);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [signingPlayerId, setSigningPlayerId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const freeAgents = useMemo(() => filterUnownedPlayers(players, ownedPlayerIds), [ownedPlayerIds, players]);
  const filteredAgents = useMemo(
    () => filterAndSortFreeAgents(freeAgents, filters),
    [filters, freeAgents],
  );
  const marketStatus = getMarketStatus({ openRosterSlots: capacity.openRosterSlots, capSpace });
  const contractFor = (player) => ({ salary: getInitialSalary(player.overall), yearsRemaining: INITIAL_CONTRACT_YEARS });
  const signingStateFor = (player, signing) => {
    if (contractsLoading) return { disabled: true, label: "LOADING...", detail: "Confirming franchise cap space" };
    if (contractsError) return { disabled: true, label: "UNAVAILABLE", detail: "Contract data is unavailable" };
    return getPlayerSigningState({
      salary: getInitialSalary(player.overall),
      capSpace,
      openRosterSlots: capacity.openRosterSlots,
      signing,
    });
  };

  function updateFilters(next) {
    setFilters(next);
    setVisibleCount(PAGE_SIZE);
  }

  async function sign(player) {
    setSigningPlayerId(player.id);
    setActionError("");
    setSuccessMessage("");
    try {
      await signFreeAgent({ leagueId: activeLeagueId, playerId: player.id });
      setSuccessMessage(`${player.name} signed. Your roster and cap will update automatically.`);
    } catch (error) {
      setActionError(getUserFriendlyError(error, "Player could not be signed."));
    } finally {
      setSigningPlayerId(null);
    }
  }

  const dataError = actionError || ownershipError || contractsError;
  return <PageLayout><main className="free-agency-market-page">
    <header className="free-agency-header"><div><span>FULL COURT PLAYER MARKET</span><h1>Free Agency</h1></div><p>Season {activeLeague?.offseason?.nextSeason || (activeLeague?.season ?? 0) + 1} <i /> Offseason</p><small>Build your roster for next season</small></header>
    <section className="market-franchise-summary"><div className="market-franchise-summary__identity"><i>{leagueTeam?.name?.slice(0, 2).toUpperCase() || "FC"}</i><span><small>YOUR FRANCHISE</small><b title={leagueTeam?.name}>{leagueTeam?.name || "Franchise setup"}</b></span></div><dl><div><dt>Roster</dt><dd>{capacity.currentRosterCount} / {capacity.rosterSize}</dd></div><div><dt>Open Spots</dt><dd>{capacity.openRosterSlots}</dd></div><div><dt>Payroll</dt><dd>{contractsLoading ? "—" : formatMoney(payroll)}</dd></div><div><dt>Cap Space</dt><dd>{contractsLoading ? "—" : formatMoney(capSpace)}</dd></div></dl></section>
    <aside className={`market-guidance is-${marketStatus.tone}`}><div><span>{marketStatus.label}</span><b>{marketStatus.detail}</b></div>{capacity.openRosterSlots === 0 && <Link to="/my-team">View My Team</Link>}</aside>
    {dataError && <p className="market-feedback is-error" role="alert">{dataError}</p>}
    {successMessage && <p className="market-feedback is-success" role="status">{successMessage}</p>}
    <section className="player-market"><header><div><span>AVAILABLE TO SIGN</span><h2>Player Market</h2></div><p><b>{freeAgents.length}</b> available players</p></header>
      <FreeAgentFilters filters={filters} onChange={updateFilters} />
      <FreeAgentList players={filteredAgents.slice(0, visibleCount)} loading={playersLoading || ownershipLoading} unavailable={catalogEmpty || Boolean(playersError || ownershipError)} noAvailablePlayers={!playersLoading && !ownershipLoading && freeAgents.length === 0} onView={openPlayerDetails} onSign={sign} signingPlayerId={signingPlayerId} contractFor={contractFor} signingStateFor={signingStateFor} onClear={() => updateFilters(DEFAULT_FILTERS)} />
      {!playersLoading && !ownershipLoading && filteredAgents.length > 0 && <footer className="market-pagination"><span>Showing {Math.min(visibleCount, filteredAgents.length)} of {filteredAgents.length} players</span>{visibleCount < filteredAgents.length && <button className="button-secondary" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show More Players</button>}</footer>}
    </section>
    <footer className="market-cap-note">Salary cap: {formatMoney(salaryCap)} · Projected contracts are FULL COURT fantasy contracts.</footer>
  </main></PageLayout>;
}

function FreeAgencyPage() {
  const { activeLeague } = useLeague();
  return <PlayersProvider catalogVersion={activeLeague?.catalogVersion || null}><FreeAgencyContent /></PlayersProvider>;
}

export default FreeAgencyPage;
