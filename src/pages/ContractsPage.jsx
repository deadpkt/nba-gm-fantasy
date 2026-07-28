import { useState } from "react";
import CapSpacePanel from "../components/contracts/CapSpacePanel";
import ContractTable from "../components/contracts/ContractTable";
import SalaryOverview from "../components/contracts/SalaryOverview";
import PageLayout from "../components/PageLayout";
import useLeagueTeam from "../hooks/useLeagueTeam";

function ContractsPage() {
  const { leagueTeam, roster } = useLeagueTeam();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const teamName = leagueTeam?.name || "Your franchise";

  return (
    <PageLayout>
      <div className="contracts-page">
        <section className="contracts-hero"><div><p className="section-label">FRANCHISE FINANCE</p><h1>Manage the <span>numbers.</span></h1><p>Review your roster’s contract framework, cap outlook, and future flexibility. Financial data will appear when contract management is available.</p></div><div className="contracts-hero__ledger"><span>FINANCIAL STATUS</span><b>DATA UNAVAILABLE</b><small>CONTRACT SUPPORT REQUIRED</small></div></section>
        <section className="contracts-team"><div className="contracts-team__mark">{teamName.slice(0, 2).toUpperCase()}</div><div><span>FRANCHISE</span><b>{teamName}</b><small>{roster.length} rostered player{roster.length === 1 ? "" : "s"}</small></div><div><span>CAP MANAGEMENT</span><b>Awaiting contract data</b><small>Financial tracking has not been published.</small></div></section>
        <SalaryOverview />
        <div className="contracts-workspace"><ContractTable roster={roster} teamName={teamName} selectedPlayer={selectedPlayer} onSelect={setSelectedPlayer} /><CapSpacePanel player={selectedPlayer} /></div>
      </div>
    </PageLayout>
  );
}

export default ContractsPage;
