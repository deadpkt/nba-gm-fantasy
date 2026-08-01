import { useEffect, useState } from "react";
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

const HOME_PILLARS = [
  { number: "01", title: "Draft", detail: "Build your roster your way.", icon: <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5.5 13 3h6l3 2.5 5 2.8-3 6-2.5-1.4V28h-11V12.9L8 14.3l-3-6 5-2.8Z" /><path d="M13 3c.2 2.2 1.3 3.4 3 3.4S18.8 5.2 19 3M13 18h6" /></svg> },
  { number: "02", title: "Compete", detail: "Play synchronized league games.", icon: <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="7" width="24" height="18" rx="3" /><path d="M8 12h6v7H8zM18 12h6v7h-6zM13 23h6M16 25v4" /></svg> },
  { number: "03", title: "Dynasty", detail: "Win seasons and build history.", icon: <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 10 5.5 4L16 6l5.5 8L27 10l-2 13H7L5 10Z" /><path d="M8 27h16M11 18h10" /></svg> },
];

const HERO_HEADLINES = [
  "Build your dynasty.",
  "Build your roster.",
  "Outdraft your rivals.",
  "Win championships.",
  "Become legendary.",
];

function TypewriterHeadline() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return undefined;
    const timer = window.setInterval(() => setPhraseIndex((current) => (current + 1) % HERO_HEADLINES.length), 3400);
    return () => window.clearInterval(timer);
  }, []);

  const phrase = HERO_HEADLINES[phraseIndex];
  return <h1 className="gm-entry-hero__headline" aria-live="polite" aria-atomic="true"><span key={phrase} className="gm-entry-hero__phrase" aria-label={phrase}>{[...phrase].map((character, index) => <i key={`${character}-${index}`} aria-hidden="true" style={{ "--character-index": index }}>{character === " " ? "\u00a0" : character}</i>)}</span></h1>;
}

function HeroBasketball() {
  return <div className="gm-entry-hero__ball" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" /><path d="M13 33c22 8 52 4 74-14M13 67c22-8 52-4 74 14M50 4c-8 24-8 68 0 92M4 50h92" /></svg><i /></div>;
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
      <HeroBasketball />
      <div className="gm-entry-hero__particles" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
      <div className="gm-entry-hero__content"><p>FULL COURT</p><TypewriterHeadline /><div className="gm-entry-hero__copy">Draft NBA players. Build your franchise.<br />Compete with friends. Win championships.</div><div className="gm-entry-hero__actions"><Link className="button-primary" to="/league">Create or Join League <b aria-hidden="true">&rarr;</b></Link><button className="button-secondary" type="button" onClick={() => setLearnMoreOpen(true)}>Learn More <b aria-hidden="true">&#9655;</b></button></div></div>
    </section>
    <section className="gm-value-strip" id="full-court-features" aria-label="The three pillars of FULL COURT">
      {HOME_PILLARS.map((pillar) => <article key={pillar.number}><span className="gm-value-strip__number">{pillar.number}</span><i>{pillar.icon}</i><p><b>{pillar.title}</b><span>{pillar.detail}</span></p></article>)}
    </section>
    {learnMoreOpen && <HowFullCourtWorksModal onClose={() => setLearnMoreOpen(false)} />}
  </main></PageLayout>;

  const links = phaseLinks(activeLeagueId, activeLeague.status);
  return <PageLayout><main className="gm-dashboard">
    <header className="gm-dashboard__header">
      <p>GM Dashboard</p>
      <h1>{leagueTeam?.name || `${name}'s Franchise`}</h1>
      <span>{activeLeague.name} &middot; Season {activeLeague.season} &middot; {getLeagueStatusLabel(activeLeague.status)}{activeLeague.seasonProgress?.currentRound ? ` · Round ${activeLeague.seasonProgress.currentRound}` : ""}</span>
    </header>
    <LeagueProgress compact />
    <section className="gm-franchise" aria-label="Franchise snapshot">
      <header><div><span>Franchise snapshot</span><h2>{leagueTeam?.name || "Your Franchise"}</h2></div><Link to="/my-team">Manage Team</Link></header>
      <div className="gm-franchise__metrics">
        <div><span>Record</span><b>{record.wins}-{record.losses}</b></div>
        <div><span>Roster</span><b>{roster.length}/{rosterSize}</b><small>{roster.length === rosterSize ? "Complete" : `${rosterSize - roster.length} spots open`}</small></div>
        <div><span>Starting five</span><b>{lineupReady ? "Ready" : "Setup"}</b><small>{lineupReady ? "Lineup confirmed" : "Needs attention"}</small></div>
      </div>
      <nav aria-label="Franchise shortcuts">{links.map((item) => <Link key={item.to} to={item.to}>{item.label}<span aria-hidden="true">&rarr;</span></Link>)}</nav>
    </section>
  </main></PageLayout>;
}

export default HomePage;
