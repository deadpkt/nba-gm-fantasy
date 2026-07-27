import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { getLineupOverall, isLineupComplete } from "../utils/team";

function HomePage() {
  const { user } = useAuth();
  const { roster, lineup, record } = useLeagueTeam();
  const lineupReady = isLineupComplete(roster, lineup);
  const overall = getLineupOverall(roster, lineup);
  const name = user.displayName || "Coach";

  return (
    <PageLayout>
      <section className="hero-section dashboard-hero">
        <p className="section-label">FRANCHISE CENTRAL</p>
        <h1>
          Welcome back, <span>{name}.</span>
        </h1>
        <p className="hero-copy">
          Set your lineup, enter the league hub, or take the court from one
          central game menu.
        </p>
        <div className="hero-score">
          <span>LINEUP {lineupReady ? "READY" : "IN PROGRESS"}</span>
          <b>{overall ? `${overall} OVR` : "SET YOUR FIVE"}</b>
          <span>{record.wins}-{record.losses} RECORD</span>
        </div>
      </section>

      <section className="dashboard-menu" aria-label="Franchise menu">
        <Link className="dashboard-menu__item dashboard-menu__item--team" to="/my-team">
          <span>01</span>
          <small>FRANCHISE</small>
          <b>My Team</b>
          <p>Manage your roster and starting five.</p>
          <i>{roster.length}/5</i>
        </Link>
        <Link className="dashboard-menu__item dashboard-menu__item--league" to="/league">
          <span>02</span>
          <small>SEASON</small>
          <b>League</b>
          <p>Create or join a private league and enter the draft.</p>
          <i>HQ</i>
        </Link>
        <Link className="dashboard-menu__item dashboard-menu__item--games" to="/games">
          <span>03</span>
          <small>TIP-OFF</small>
          <b>Games</b>
          <p>Play an exhibition or challenge a friend online.</p>
          <i>VS</i>
        </Link>
      </section>
    </PageLayout>
  );
}

export default HomePage;
