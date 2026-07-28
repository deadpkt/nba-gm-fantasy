import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import { openPlayerDetails } from "../components/player/PlayerDetailsModal";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { getLineupOverall, isLineupComplete } from "../utils/team";

function HomePage() {
  const { user } = useAuth();
  const { roster, lineup, record, leagueTeam } = useLeagueTeam();
  const { activeLeague, members } = useLeague();
  const lineupReady = isLineupComplete(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const name = user.displayName || "Coach";
  const featuredPlayer = [...roster].sort(
    (first, second) => second.overall - first.overall,
  )[0];
  const leagueName = activeLeague?.name || "No active league";
  const teamName = leagueTeam?.name || `${name}'s Franchise`;
  const nextMatchLabel = lineupReady ? "Ready to schedule" : "Complete your lineup";

  return (
    <PageLayout>
      <div className="dashboard-shell">
        <section className="dashboard-welcome">
          <div>
            <p className="section-label">FRANCHISE COMMAND CENTER</p>
            <h1>Welcome back, <span>{name}.</span></h1>
            <p>Manage your unit, chase the season, and take control at tip-off.</p>
          </div>
          <div className="dashboard-welcome__live"><i /><span>FRANCHISE ONLINE</span><b>{lineupReady ? "GAME READY" : "LINEUP SETUP"}</b></div>
        </section>

        <section className="dashboard-hero-card" aria-label="Team overview">
          <div className="dashboard-hero-card__noise" aria-hidden="true" />
          <div className="dashboard-hero-card__identity">
            <span>YOUR FRANCHISE</span>
            <h2>{teamName}</h2>
            <p>{leagueName}</p>
            <Link to="/my-team">Manage team <b>→</b></Link>
          </div>
          <div className="dashboard-hero-card__overall">
            <span>TEAM OVERALL</span>
            <b>{overall || "--"}</b>
            <small>{lineupReady ? "STARTING FIVE ACTIVE" : `${roster.length}/5 PLAYERS SELECTED`}</small>
          </div>
          <div className="dashboard-hero-card__silhouette" aria-hidden="true">FC</div>
        </section>

        <section className="dashboard-metrics" aria-label="Franchise metrics">
          <article><span>SEASON RECORD</span><b>{record.wins}<i>-{record.losses}</i></b><small>League matches</small></article>
          <article><span>CURRENT LEAGUE</span><b>{activeLeague?.season ? `S${activeLeague.season}` : "--"}</b><small>{activeLeague ? `${members.length}/${activeLeague.maxMembers} franchises` : "Join a league to compete"}</small></article>
          <article><span>NEXT MATCH</span><b className="dashboard-metrics__next">{lineupReady ? "READY" : "LOCKED"}</b><small>{nextMatchLabel}</small></article>
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-featured">
            <div className="dashboard-panel__head"><div><span>FEATURED PLAYER</span><b>Franchise spotlight</b></div><Link to="/my-team">Roster →</Link></div>
            {featuredPlayer ? <button type="button" className="dashboard-featured__player" style={{ "--featured-color": featuredPlayer.color || "#e32842" }} onClick={() => openPlayerDetails(featuredPlayer)}>
              <div className="dashboard-featured__image"><img src={featuredPlayer.image} alt={featuredPlayer.name} /></div>
              <div className="dashboard-featured__copy"><small>{featuredPlayer.position} · {featuredPlayer.team}</small><h2>{featuredPlayer.name}</h2><p>Highest-rated player on your current roster.</p><div><span>OVR <b>{featuredPlayer.overall}</b></span><span>PTS <b>{featuredPlayer.stats?.points ?? "--"}</b></span><span>AST <b>{featuredPlayer.stats?.assists ?? "--"}</b></span></div></div>
            </button> : <div className="dashboard-featured__empty"><b>Your spotlight awaits.</b><p>Add a player to your franchise roster to unlock a featured card.</p><Link to="/draft">Explore players →</Link></div>}
          </article>

          <aside className="dashboard-activity">
            <div className="dashboard-panel__head"><div><span>RECENT ACTIVITY</span><b>Franchise feed</b></div><i>LIVE</i></div>
            <div className="dashboard-activity__item"><i className={lineupReady ? "is-ready" : ""} /><div><span>LINEUP STATUS</span><b>{lineupReady ? "Starting five locked in" : "Starting five in progress"}</b></div><small>NOW</small></div>
            <div className="dashboard-activity__item"><i /><div><span>LEAGUE HQ</span><b>{activeLeague ? `${activeLeague.name} is active` : "No active league selected"}</b></div><small>—</small></div>
            <div className="dashboard-activity__item"><i /><div><span>NEXT GAME</span><b>{lineupReady ? "Choose a game mode to tip off" : "Awaiting a complete lineup"}</b></div><small>—</small></div>
            <p>Activity will populate as your franchise plays.</p>
          </aside>
        </section>

        <section className="dashboard-actions" aria-label="Quick actions">
          <div className="dashboard-panel__head"><div><span>QUICK ACTIONS</span><b>Where to next?</b></div></div>
          <div>
            <Link to="/my-team"><span>01</span><b>Set lineup</b><small>Manage your starters</small><i>→</i></Link>
            <Link to="/league"><span>02</span><b>League HQ</b><small>Build your season</small><i>→</i></Link>
            <Link to="/games"><span>03</span><b>Play now</b><small>Enter game modes</small><i>→</i></Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

export default HomePage;
