import PageLayout from "../components/PageLayout";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { formatMoney } from "../lib/contracts";
import { getLeagueSalaryCap, getRosterCapacity } from "../lib/rosterConfig";

function FreeAgencyPage() {
  const { roster, leagueTeam } = useLeagueTeam();
  const { activeLeague } = useLeague();
  const capacity = getRosterCapacity(activeLeague, roster);
  const salaryCap = getLeagueSalaryCap(activeLeague);

  return <PageLayout><div className="free-agency-page">
    <section className="free-agency-hero"><div><p className="section-label">PLAYER MARKETPLACE</p><h1>Find your <span>edge.</span></h1><p>Scout the market, identify roster needs, and prepare your next move. Player signing remains unavailable until free-agency support is published.</p></div><div className="free-agency-hero__market"><span>MARKET STATUS</span><b>AWAITING AVAILABILITY</b><small>FREE-AGENT DATA REQUIRED</small></div></section>
    <section className="free-agency-team"><div className="free-agency-team__mark">{leagueTeam?.name?.slice(0, 2).toUpperCase() || "FC"}</div><div><span>YOUR FRANCHISE</span><b>{leagueTeam?.name || "Franchise setup"}</b><small>{capacity.currentRosterCount}/{capacity.rosterSize} roster spots filled</small></div><div><span>OPEN SPOTS</span><b>{capacity.openRosterSlots}</b><small>{capacity.openRosterSlots ? "Available roster spots" : "Roster at configured capacity"}</small></div><div><span>SALARY CAP</span><b>{formatMoney(salaryCap)}</b><small>League-version cap</small></div></section>
    <section className="free-agency-market"><header><div><span>AVAILABLE PLAYERS</span><h2>Free agency <i>Locked</i></h2></div></header><div className="free-agency-empty"><div><b>Free Agency is not active yet</b><p>The market will use unowned, active Draft-eligible players from the canonical NBA catalog when Phase 17 is implemented.</p></div></div></section>
  </div></PageLayout>;
}

export default FreeAgencyPage;
