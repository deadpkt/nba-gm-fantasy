import { useState } from "react";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";
import { saveExhibitionResult } from "../lib/matchHistory";
import { simulateGame } from "../utils/simulateGame";
import {
  getMissingLineupPositions,
  getLineupPlayers,
  getTeamOverall,
  isLineupComplete,
} from "../utils/team";

function SimulationPage() {
  const { user } = useAuth();
  const { activeLeagueId, roster, lineup } = useLeagueTeam();
  const {
    players,
    playersLoading,
    playersError,
    fallbackUsed,
    catalogEmpty,
  } = usePlayers();
  const [result, setResult] = useState(null);
  const opponent = players.slice(6, 11);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const canPlay =
    !playersLoading &&
    !catalogEmpty &&
    !playersError &&
    opponent.length === 5 &&
    isLineupComplete(roster, lineup);
  const activeTeam = getLineupPlayers(roster, lineup);

  async function playGame() {
    if (!canPlay) return;
    const game = simulateGame(activeTeam, opponent);
    setResult(game);
    try {
      await saveExhibitionResult({
        user,
        leagueId: activeLeagueId,
        roster: activeTeam,
        lineup,
        opponent,
        game,
      });
    } catch (error) {
      console.error("Could not save exhibition result:", error);
    }
  }

  return (
    <PageLayout>
      <section className="page-hero simulation-hero">
        <p className="section-label">EXHIBITION MATCHUP</p>
        <h1>
          Ready for <span>tip-off?</span>
        </h1>
        <p>Your squad faces an elite Full Court AI roster.</p>
      </section>
      <section className="matchup-panel">
        <div className="scoreboard-ribbon">
          <span>
            <i /> LIVE SIMULATION
          </span>
          <b>Q1 12:00</b>
          <span>FULL COURT ARENA</span>
        </div>
        <div className="match-team">
          <span className="match-logo home-logo">FC</span>
          <p>YOUR TEAM</p>
          <b>{getTeamOverall(activeTeam)}</b>
          <small>TEAM OVR</small>
        </div>
        <div className="match-center">
          <span>VS</span>
          <button onClick={playGame} disabled={!canPlay}>
            Simulate match
          </button>
          <small>
            {playersLoading
              ? "LOADING PLAYER CATALOG"
              : catalogEmpty || playersError || opponent.length !== 5
                ? "PLAYER CATALOG UNAVAILABLE"
                : canPlay
                  ? fallbackUsed
                    ? "USING LOCAL PLAYER CATALOG"
                    : "OVR + RANDOM PERFORMANCE"
                  : `MISSING: ${missingPositions.join(", ")}`}
          </small>
        </div>
        <div className="match-team">
          <span className="match-logo away-logo">AI</span>
          <p>COURT KINGS</p>
          <b>{getTeamOverall(opponent)}</b>
          <small>TEAM OVR</small>
        </div>
      </section>
      {result && (
        <section className="result-panel">
          <p className="section-label">FINAL SCORE</p>
          <div className="final-score">
            <div>
              <span>Your Team</span>
              <b className={result.homeWon ? "winner" : ""}>
                {result.home.score}
              </b>
            </div>
            <em>-</em>
            <div>
              <span>Court Kings</span>
              <b className={!result.homeWon ? "winner" : ""}>
                {result.away.score}
              </b>
            </div>
          </div>
          <div className="mvp">
            <img src={result.mvp.image} alt={result.mvp.name} />
            <div>
              <span>GAME MVP</span>
              <strong>{result.mvp.name}</strong>
              <small>
                {result.mvp.overall} OVR / {result.mvp.position}
              </small>
            </div>
          </div>
          <div className="team-stats">
            <Stat
              title="FG%"
              home={result.home.fieldGoal}
              away={result.away.fieldGoal}
            />
            <Stat
              title="REB"
              home={result.home.rebounds}
              away={result.away.rebounds}
            />
            <Stat
              title="AST"
              home={result.home.assists}
              away={result.away.assists}
            />
            <Stat
              title="TO"
              home={result.home.turnovers}
              away={result.away.turnovers}
            />
          </div>
        </section>
      )}
    </PageLayout>
  );
}

function Stat({ title, home, away }) {
  return (
    <div>
      <span>{title}</span>
      <b>{home}</b>
      <i>{away}</i>
    </div>
  );
}

export default SimulationPage;
