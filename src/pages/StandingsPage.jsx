import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import {
  MyStandingSummary,
  RaceInsight,
  StandingsHeader,
  StandingsSkeleton,
  StandingsTable,
} from "../components/standings/LeagueRaceCenter";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import { getUserFriendlyError, reportClientError } from "../lib/clientErrors";
import { isOfficialGameFinalVisible } from "../lib/officialGamePresentation";
import { finalizeRegularSeason, initializePlayoffs } from "../lib/officialGames";
import { playoffQualifierCount } from "../lib/postseason";
import { deriveRaceInsight, visibleStandingsGames } from "../lib/standingsRace";
import { calculateStandings, findRecordMismatches } from "../lib/standings";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import "../standings.css";

function StandingsPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, teams, members } = useLeague();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [presentationNow, setPresentationNow] = useState(Date.now());
  const [finalizationRequested, setFinalizationRequested] = useState(false);
  const [playoffBusy, setPlayoffBusy] = useState(false);
  const [playoffError, setPlayoffError] = useState("");
  const visibleGames = useMemo(
    () => visibleStandingsGames(games, presentationNow),
    [games, presentationNow],
  );
  const standings = useMemo(
    () => calculateStandings(teams, visibleGames, activeLeague?.season),
    [activeLeague?.season, teams, visibleGames],
  );
  const finalResult = activeLeague?.regularSeasonResult;
  const finalTable = finalResult?.season === activeLeague?.season;
  const displayStandings = finalTable
    ? finalResult.standings.map((row) => ({
        teamUid: row.uid, teamName: row.teamName, rank: row.seed,
        gp: row.gp, wins: row.wins, losses: row.losses,
        winPercentage: row.winPct, pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst, pointDifferential: row.differential,
        streak: standings.find((liveRow) => liveRow.teamUid === row.uid)?.streak || "-",
      }))
    : standings;
  const leagueSize = activeLeague?.memberIds?.length || activeLeague?.maxMembers || teams.length;
  const qualifierCount = activeLeague?.postseason?.qualifierCount || (leagueSize ? playoffQualifierCount(leagueSize) : 2);
  const currentRow = displayStandings.find((row) => row.teamUid === user.uid);
  const raceInsight = deriveRaceInsight(displayStandings, qualifierCount, user.uid);
  const presentationClockActive = games.some(
    (game) => game.timeline?.length && !isOfficialGameFinalVisible(game, presentationNow),
  );

  useEffect(() => {
    if (!presentationClockActive) return undefined;
    const interval = window.setInterval(() => setPresentationNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [presentationClockActive]);

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
      reportClientError("Standings finalization", finalizeError);
    });
  }, [activeLeague?.seasonProgress?.regularSeasonComplete, activeLeagueId, finalResult, finalizationRequested]);

  useEffect(() => {
    if (!import.meta.env.DEV || loading) return;
    const mismatches = findRecordMismatches(standings);
    if (mismatches.length) console.warn("[Standings] Stored records differ from official results.", { count: mismatches.length });
  }, [loading, standings]);

  async function initializePostseason() {
    setPlayoffBusy(true);
    setPlayoffError("");
    try {
      await initializePlayoffs({ leagueId: activeLeagueId });
    } catch (nextError) {
      setPlayoffError(getUserFriendlyError(nextError, "Playoffs could not be prepared."));
    } finally {
      setPlayoffBusy(false);
    }
  }

  return (
    <PageLayout>
      <main className="league-race-center">
        <StandingsHeader league={activeLeague} qualifierCount={qualifierCount} finalTable={finalTable} />
        {loading ? <StandingsSkeleton /> : error ? <section className="standings-empty" role="alert">{error}</section> : games.length === 0 ? (
          <section className="standings-empty"><span>STANDINGS NOT AVAILABLE YET</span><h2>The league race begins when the season starts.</h2><p>Official completed games will automatically build the table.</p><Link className="button-primary" to={`/league/${activeLeagueId}`}>Go to League</Link></section>
        ) : <>
          <MyStandingSummary row={currentRow} leader={displayStandings[0]} qualifierCount={qualifierCount} />
          <section className="race-surface">
            <header><div><span>{finalTable ? "FINAL REGULAR-SEASON TABLE" : "LIVE LEAGUE TABLE"}</span><h2>{activeLeague?.name}</h2></div><small>{visibleGames.length} completed {visibleGames.length === 1 ? "game" : "games"}</small></header>
            <StandingsTable rows={displayStandings} currentUid={user.uid} members={members} qualifierCount={qualifierCount} finalTable={finalTable} />
          </section>
          <RaceInsight>{raceInsight}</RaceInsight>
          {finalTable && <PostseasonControl league={activeLeague} user={user} busy={playoffBusy} error={playoffError} onInitialize={initializePostseason} />}
        </>}
      </main>
    </PageLayout>
  );
}

function PostseasonControl({ league, user, busy, error, onInitialize }) {
  const playoffsActive = league.status === LEAGUE_STATUS.PLAYOFFS;
  return <section className="postseason-control"><div><span>POSTSEASON</span><h2>{playoffsActive ? "The playoff bracket is live." : "Final seeds are ready."}</h2><p>The final regular-season order remains frozen.</p></div>{playoffsActive ? <Link className="button-primary" to="/playoffs">View Playoffs</Link> : league.postseason?.status === "ready" && league.commissionerUid === user.uid ? <button className="button-primary" type="button" disabled={busy} onClick={onInitialize}>{busy ? "Initializing..." : "Initialize Playoffs"}</button> : <span className="postseason-control__status">Waiting for the commissioner</span>}{error && <p className="postseason-control__error" role="alert">{error}</p>}</section>;
}

export default StandingsPage;
