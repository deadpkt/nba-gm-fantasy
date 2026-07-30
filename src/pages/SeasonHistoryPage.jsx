import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";
import "../seasonHistory.css";

function SeasonHistoryPage() {
  const { activeLeagueId, activeLeague } = useLeague();
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    return onSnapshot(query(collection(db, "leagues", activeLeagueId, "seasons"), orderBy("season", "desc")), (snapshot) => {
      setSeasons(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, () => {
      setError("Season history is currently unavailable.");
      setLoading(false);
    });
  }, [activeLeagueId]);

  return <PageLayout>
    <section className="page-hero history-hero"><p className="section-label">{activeLeague?.name}</p><h1>Season <span>history.</span></h1><p>Permanent league championships, standings, and playoff results.</p></section>
    <section className="season-history">
      {loading ? <p>Loading completed seasons...</p> : error ? <p role="alert">{error}</p> : seasons.length === 0 ? <p>No completed season history is available yet.</p> : seasons.map((season) => <article className="season-history__season" key={season.id}>
        <header><span>SEASON {season.season}</span><b>COMPLETED</b></header>
        <div className="season-history__honors"><div><small>CHAMPION</small><strong>🏆 {season.champion.teamName}</strong><span>Seed #{season.champion.seed}</span></div><div><small>RUNNER-UP</small><strong>{season.runnerUp.teamName}</strong><span>Seed #{season.runnerUp.seed}</span></div></div>
        <section><h2>Final standings</h2>{season.regularSeason.standings.map((team) => <p className="season-history__row" key={team.uid}><b>#{team.seed} {team.teamName}</b><span>{team.wins}-{team.losses}</span></p>)}</section>
        <section><h2>Playoffs</h2>{season.playoffs.games.map((game) => <div className="season-history__game" key={game.gameId}><small>{game.stage === "final" ? "FINAL" : "SEMIFINAL"}</small><p><b>#{game.away.seed} {game.away.teamName}</b><strong>{game.away.score}</strong></p><p><b>#{game.home.seed} {game.home.teamName}</b><strong>{game.home.score}</strong></p></div>)}</section>
      </article>)}
    </section>
  </PageLayout>;
}

export default SeasonHistoryPage;
