import { useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import LeagueProgress from "../components/LeagueProgress";
import DecorativeBasketballCourt from "../components/DecorativeBasketballCourt";
import HowFullCourtWorksModal from "../components/HowFullCourtWorksModal";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { isLineupComplete } from "../utils/team";
import "../dashboard.css";

function phaseLinks(leagueId, status) {
  const league = { to: `/league/${leagueId}`, label: "League" };
  if (status === LEAGUE_STATUS.DRAFTING) return [league, { to: "/league/draft", label: "Draft" }];
  if (status === LEAGUE_STATUS.SEASON_READY) return [league, { to: "/my-team", label: "My Team" }];
  if (status === LEAGUE_STATUS.REGULAR_SEASON) return [league, { to: "/games", label: "Games" }, { to: "/standings", label: "Standings" }];
  if (status === LEAGUE_STATUS.PLAYOFFS) return [league, { to: "/playoffs", label: "Playoffs" }, { to: "/standings", label: "Standings" }];
  if (status === LEAGUE_STATUS.OFFSEASON) return [league, { to: "/free-agency", label: "Free Agency" }, { to: "/league/history", label: "History" }];
  return [league];
}

function HomePage() {
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const { user } = useAuth();
  const { roster, lineup, record, leagueTeam } = useLeagueTeam();
  const { activeLeague, activeLeagueId } = useLeague();
  const rosterSize = normalizeRosterConfig(activeLeague).rosterSize;
  const lineupReady = isLineupComplete(roster, lineup);
  const name = user.displayName || "GM";

  if (!activeLeague || !activeLeagueId) return <PageLayout><main className="gm-dashboard gm-dashboard--empty">
    <section className="gm-entry-hero">
      <DecorativeBasketballCourt className="gm-entry-hero__court" />
      <div><p>FULL COURT</p><h1>Build your <span>dynasty.</span></h1><div className="gm-entry-hero__copy">Draft NBA players. Build your franchise.<br />Compete with friends. Win championships.</div><div className="gm-entry-hero__actions"><Link className="button-primary" to="/league">Create or Join League <b aria-hidden="true">→</b></Link><button className="button-secondary" type="button" onClick={() => setLearnMoreOpen(true)}>Learn More <b aria-hidden="true">▷</b></button></div></div>
    </section>
    <section className="gm-value-strip" id="full-court-features" aria-label="How FULL COURT works"><div><i aria-hidden="true">◇</i><p><b>Draft</b><span>Build your roster your way</span></p></div><div><i aria-hidden="true">♜</i><p><b>Compete</b><span>Play synchronized league games</span></p></div><div><i aria-hidden="true">☆</i><p><b>Dynasty</b><span>Win seasons and build history</span></p></div></section>
    {learnMoreOpen && <HowFullCourtWorksModal onClose={() => setLearnMoreOpen(false)} />}
  </main></PageLayout>;

  const links = phaseLinks(activeLeagueId, activeLeague.status);
  return <PageLayout><main className="gm-dashboard">
    <header className="gm-dashboard__header">
      <p>GM Dashboard</p>
      <h1>{leagueTeam?.name || `${name}'s Franchise`}</h1>
      <span>{activeLeague.name} · Season {activeLeague.season} · {getLeagueStatusLabel(activeLeague.status)}{activeLeague.seasonProgress?.currentRound ? ` · Round ${activeLeague.seasonProgress.currentRound}` : ""}</span>
    </header>

    <LeagueProgress compact />

    <section className="gm-franchise" aria-label="Franchise snapshot">
      <header><div><span>Franchise snapshot</span><h2>{leagueTeam?.name || "Your Franchise"}</h2></div><Link to="/my-team">Manage Team</Link></header>
      <div className="gm-franchise__metrics">
        <div><span>Record</span><b>{record.wins}-{record.losses}</b></div>
        <div><span>Roster</span><b>{roster.length}/{rosterSize}</b><small>{roster.length === rosterSize ? "Complete" : `${rosterSize - roster.length} spots open`}</small></div>
        <div><span>Starting five</span><b>{lineupReady ? "Ready" : "Setup"}</b><small>{lineupReady ? "Lineup confirmed" : "Needs attention"}</small></div>
      </div>
      <nav aria-label="Franchise shortcuts">{links.map((item) => <Link key={item.to} to={item.to}>{item.label}<span aria-hidden="true">→</span></Link>)}</nav>
    </section>
  </main></PageLayout>;
}

export default HomePage;
