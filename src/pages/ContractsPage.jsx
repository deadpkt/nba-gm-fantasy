import { useState } from "react";
import CapSpacePanel from "../components/contracts/CapSpacePanel";
import ContractTable from "../components/contracts/ContractTable";
import SalaryOverview from "../components/contracts/SalaryOverview";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueContracts from "../hooks/useLeagueContracts";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { initializeLeagueContracts } from "../lib/contracts";
import { getUserFriendlyError } from "../lib/clientErrors";

function ContractsPage() {
  const { user } = useAuth();
  const { activeLeague, activeLeagueId } = useLeague();
  const { leagueTeam, roster } = useLeagueTeam();
  const { teamContracts, contractsLoading, contractsError, contractsInitialized, payroll, capSpace, salaryCap, validation } = useLeagueContracts();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [actionError, setActionError] = useState("");
  const teamName = leagueTeam?.name || "Your franchise";
  const selectedContract = teamContracts.find((contract) => String(contract.playerId) === String(selectedPlayer?.id));
  const isCommissioner = activeLeague?.commissionerUid === user.uid;

  async function initialize() {
    setInitializing(true); setActionError("");
    try { await initializeLeagueContracts({ leagueId: activeLeagueId }); } catch (error) { setActionError(getUserFriendlyError(error, "Contracts could not be initialized.")); } finally { setInitializing(false); }
  }

  return <PageLayout><div className="contracts-page">
    <section className="contracts-hero"><div><p className="section-label">FRANCHISE FINANCE</p><h1>Team <span>contracts.</span></h1><p>Review salaries, contract terms, and your franchise's cap flexibility.</p></div><div className="contracts-hero__ledger"><span>FINANCIAL STATUS</span><b>{contractsInitialized ? validation.valid ? "CAP COMPLIANT" : "REVIEW REQUIRED" : "INITIALIZATION REQUIRED"}</b><small>SEASON {activeLeague?.season}</small></div></section>
    <section className="contracts-team"><div className="contracts-team__mark">{teamName.slice(0, 2).toUpperCase()}</div><div><span>FRANCHISE</span><b>{teamName}</b><small>{roster.length} rostered players</small></div><div><span>CAP MANAGEMENT</span><b>{contractsInitialized ? `${teamContracts.length} of ${roster.length} contracts` : "Contracts not initialized"}</b><small>{contractsInitialized ? "Official league financial status" : isCommissioner ? "Set up contracts for every franchise" : "Waiting for the commissioner"}</small></div>{!contractsInitialized && isCommissioner && <button className="button-primary" type="button" disabled={initializing} onClick={initialize}>{initializing ? "Initializing..." : "Initialize League Contracts"}</button>}</section>
    {(contractsError || actionError) && <p className="official-game-error" role="alert">{contractsError || actionError}</p>}
    <SalaryOverview payroll={payroll} capSpace={capSpace} salaryCap={salaryCap} contractCount={teamContracts.length} initialized={contractsInitialized} />
    {contractsLoading ? <p className="contracts-loading">Loading contracts...</p> : <div className="contracts-workspace"><ContractTable roster={roster} contracts={teamContracts} teamName={teamName} selectedPlayer={selectedPlayer} onSelect={setSelectedPlayer} /><CapSpacePanel player={selectedPlayer} contract={selectedContract} /></div>}
  </div></PageLayout>;
}
export default ContractsPage;
