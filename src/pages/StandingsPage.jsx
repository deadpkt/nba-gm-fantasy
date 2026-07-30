import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { finalizeRegularSeason, initializePlayoffs } from "../lib/officialGames";
import { calculateStandings, findRecordMismatches } from "../lib/standings";
import "../standings.css";

const formatWinPercentage = (value) => value.toFixed(3).replace(/^0/, "");

function StandingsPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, teams } = useLeague();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finalizationRequested, setFinalizationRequested] = useState(false);
  const [playoffBusy, setPlayoffBusy] = useState(false);
  const [playoffError, setPlayoffError] = useState("");
  const standings = useMemo(
    () => calculateStandings(teams, games, activeLeague?.season),
    [activeLeague?.season, games, teams],
  );
  const finalResult = activeLeague?.regularSeasonResult;
  const qualifiers = activeLeague?.postseason?.qualifiers || [];
  const qualifierUids = new Set(qualifiers.map((qualifier) => qualifier.uid));
  const displayStandings = finalResult?.season === activeLeague?.season
    ? finalResult.standings.map((row) => ({
        teamUid: row.uid, teamName: row.teamName, rank: row.seed,
        gp: row.gp, wins: row.wins, losses: row.losses,
        winPercentage: row.winPct, pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst, pointDifferential: row.differential,
        streak: standings.find((liveRow) => liveRow.teamUid === row.uid)?.streak || "-",
      }))
    : standings;

  useEffect(() => {
    if (!activeLeagueId || !activeLeague?.season) {
      setGames([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError("");
    return onSnapshot(
      query(collection(db, "leagues", activeLeagueId, "games"), where("season", "==", activeLeague.season)),
      (snapshot) => {
        setGames(snapshot.docs.map((game) => ({ id: game.id, ...game.data() })).sort((a, b) => (a.scheduledOrder ?? 0) - (b.scheduledOrder ?? 0)));
        setLoading(false);
      },
      () => {
        setError("The official standings are currently unavailable.");
        setLoading(false);
      },
    );
  }, [activeLeague?.season, activeLeagueId]);

  useEffect(() => {
    setFinalizationRequested(false);
  }, [activeLeagueId]);

  useEffect(() => {
    if (
      !activeLeagueId || finalizationRequested || finalResult ||
      activeLeague?.seasonProgress?.regularSeasonComplete !== true
    ) return;
    setFinalizationRequested(true);
    void finalizeRegularSeason({ leagueId: activeLeagueId }).catch((finalizeError) => {
      if (import.meta.env.DEV) console.warn("[Standings] Trusted legacy finalization was not available.", finalizeError);
    });
  }, [activeLeague?.seasonProgress?.regularSeasonComplete, activeLeagueId, finalResult, finalizationRequested]);

  useEffect(() => {
    if (!import.meta.env.DEV || loading) return;
    const mismatches = findRecordMismatches(standings);
    if (mismatches.length) console.warn("[Standings] Stored records differ from official results.", mismatches);
  }, [loading, standings]);

  return (
    <PageLayout>
      <section className="page-hero standings-hero">
        <p className="section-label">SEASON {activeLeague?.season}</p>
        <h1>Regular season <span>standings.</span></h1>
        <p>{activeLeague?.seasonProgress?.regularSeasonComplete ? "REGULAR SEASON COMPLETE — Final seeds are frozen for postseason preparation." : "Live league table derived from completed official games."}</p>
      </section>
      <section className="standings-shell">
        <header><div><span>{finalResult ? "FINAL REGULAR-SEASON TABLE" : "OFFICIAL LEAGUE TABLE"}</span><b>{activeLeague?.name}</b></div><small>{displayStandings.reduce((total, row) => total + row.gp, 0) / 2} completed games</small></header>
        {loading ? <p className="standings-state">Loading official standings...</p> : error ? <p className="standings-state" role="alert">{error}</p> : (
          <div className="standings-table-wrap"><table className="standings-table">
            <thead><tr><th>RK</th><th>TEAM</th><th>GP</th><th>W</th><th>L</th><th>WIN%</th><th>PF</th><th>PA</th><th>DIFF</th><th>STREAK</th></tr></thead>
            <tbody>{displayStandings.map((row) => (
              <tr className={`${row.teamUid === user.uid ? "is-current" : ""} ${row.rank === 1 ? "is-top-seed" : ""}`} key={row.teamUid}>
                <td><strong>{row.rank}</strong></td>
                <td><span className="standings-team"><i>{row.teamName.slice(0, 2).toUpperCase()}</i><b>{row.teamName}</b><small>{finalResult ? qualifierUids.has(row.teamUid) ? "QUALIFIED" : "ELIMINATED" : row.teamUid === user.uid ? "YOUR TEAM" : ""}</small></span></td>
                <td>{row.gp}</td><td>{row.wins}</td><td>{row.losses}</td><td>{formatWinPercentage(row.winPercentage)}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td>
                <td className={row.pointDifferential > 0 ? "is-positive" : row.pointDifferential < 0 ? "is-negative" : ""}>{row.pointDifferential > 0 ? "+" : ""}{row.pointDifferential}</td>
                <td><em className={row.streak.startsWith("W") ? "is-winning" : row.streak.startsWith("L") ? "is-losing" : ""}>{row.streak}</em></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {finalResult && (
          <section className="playoff-field">
            <div><span>POSTSEASON FIELD</span><b>{qualifiers.length} QUALIFIERS</b></div>
            <ol>{qualifiers.map((team) => <li key={team.uid}><strong>#{team.seed}</strong><b>{team.teamName}</b><small>QUALIFIED</small></li>)}</ol>
            <p>Seeds are final and ready for trusted playoff bracket initialization.</p>
            {activeLeague?.postseason?.status === "ready" && activeLeague.commissionerUid === user.uid && (
              <button className="button-primary" type="button" disabled={playoffBusy} onClick={async () => {
                setPlayoffBusy(true); setPlayoffError("");
                try { await initializePlayoffs({ leagueId: activeLeagueId }); } catch (nextError) { setPlayoffError(nextError.message); } finally { setPlayoffBusy(false); }
              }}>{playoffBusy ? "Initializing..." : "Initialize Playoffs"}</button>
            )}
            {playoffError && <p role="alert">{playoffError}</p>}
          </section>
        )}
        <footer>Ranking: WIN% · Wins · Point Differential · Points For · Team Name</footer>
      </section>
    </PageLayout>
  );
}

export default StandingsPage;
