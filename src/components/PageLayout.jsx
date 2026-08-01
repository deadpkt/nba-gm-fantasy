import { Link } from "react-router-dom";
import useLeague from "../hooks/useLeague";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import Header from "./Header";
import PlayerDetailsModal from "./player/PlayerDetailsModal";

function PageLayout({ children }) {
  const { activeLeague, activeLeagueId } = useLeague();
  const showLeagueContext =
    activeLeague && activeLeague.status !== LEAGUE_STATUS.CANCELLED;

  return (
    <main>
      <Header />
      {showLeagueContext && (
        <div
          className="league-context-strip"
          aria-label="Current league context"
        >
          <Link to={`/league/${activeLeagueId}`}>
            <b>{activeLeague.name}</b>
            <span>SEASON {activeLeague.season}</span>
          </Link>
          <i aria-hidden="true" />
          <span
            className={`league-phase-badge league-phase-badge--${activeLeague.status}`}
          >
            {getLeagueStatusLabel(activeLeague.status)}
          </span>
        </div>
      )}
      {children}
      <PlayerDetailsModal />
    </main>
  );
}

export default PageLayout;
