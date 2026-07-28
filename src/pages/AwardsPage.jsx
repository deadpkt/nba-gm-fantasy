import AwardCard from "../components/awards/AwardCard";
import LeagueLeaderCard from "../components/awards/LeagueLeaderCard";
import StatsTable from "../components/awards/StatsTable";
import PageLayout from "../components/PageLayout";
import usePlayers from "../hooks/usePlayers";

const leaderDefinitions = [
  { key: "points", title: "Points Per Game", label: "PPG" },
  { key: "rebounds", title: "Rebounds Per Game", label: "RPG" },
  { key: "assists", title: "Assists Per Game", label: "APG" },
  { key: "steals", title: "Steals Per Game", label: "SPG" },
  { key: "blocks", title: "Blocks Per Game", label: "BPG" },
];

const awardDefinitions = [
  { title: "MVP", abbreviation: "MVP", unavailableReason: "MVP voting or season award data has not been published." },
  { title: "Defensive Player of the Year", abbreviation: "DPOY", unavailableReason: "Defensive award data requires steals and blocks, which are unavailable." },
  { title: "Rookie of the Year", abbreviation: "ROY", unavailableReason: "Rookie eligibility data is not available in the current player catalog." },
  { title: "Most Improved Player", abbreviation: "MIP", unavailableReason: "Previous-season statistics are not available for improvement comparisons." },
  { title: "Scoring Champion", abbreviation: "SC", statKey: "points", statLabel: "PPG" },
];

function hasStatistic(player, key) {
  return Number.isFinite(player.stats?.[key]);
}

function leadersFor(players, key) {
  return players
    .filter((player) => hasStatistic(player, key))
    .toSorted((first, second) => second.stats[key] - first.stats[key] || second.overall - first.overall);
}

function formatStatistic(player, key) {
  return player.stats[key].toFixed(1);
}

function AwardsPage() {
  const { players, playersLoading, catalogEmpty, playersError } = usePlayers();
  const leaderLists = Object.fromEntries(leaderDefinitions.map(({ key }) => [key, leadersFor(players, key)]));
  const scoringChampion = leaderLists.points[0];
  const catalogUnavailable = catalogEmpty || Boolean(playersError);

  return (
    <PageLayout>
      <main className="awards-page">
        <section className="awards-hero">
          <div><p className="section-label">SEASON HONORS</p><h1>Earn your <span>legacy.</span></h1><p>Celebrate the season’s elite and see who is leading the league’s available statistical categories.</p></div>
          <div className="awards-hero__crest" aria-hidden="true"><span>FC</span><b>AWARDS</b><small>SEASON HONORS</small></div>
        </section>

        <section className="awards-section" aria-labelledby="awards-heading">
          <header className="awards-section__heading"><div><p className="section-label">AWARDS RACE</p><h2 id="awards-heading">Season honors</h2></div><small>Based on published player data</small></header>
          {playersLoading ? <p className="awards-loading">Loading player catalog...</p> : catalogUnavailable ? <p className="awards-loading">Player statistics are unavailable. Please try again later.</p> : <div className="awards-grid">{awardDefinitions.map((award) => <AwardCard key={award.abbreviation} {...award} player={award.statKey ? scoringChampion : null} statistic={award.statKey && scoringChampion ? { value: formatStatistic(scoringChampion, award.statKey), label: award.statLabel } : null} />)}</div>}
        </section>

        <section className="leaders-section" aria-labelledby="leaders-heading">
          <header className="awards-section__heading"><div><p className="section-label">LEAGUE LEADERS</p><h2 id="leaders-heading">The numbers</h2></div><small>Current player catalog</small></header>
          {playersLoading ? <p className="awards-loading">Loading player catalog...</p> : catalogUnavailable ? <p className="awards-loading">League leader data is unavailable.</p> : <><div className="leaders-featured">{leaderDefinitions.map(({ key, title, label }) => { const player = leaderLists[key][0]; return <LeagueLeaderCard key={key} title={title} player={player} statistic={player ? { value: formatStatistic(player, key), label } : null} />; })}</div><div className="leaders-tables">{leaderDefinitions.map(({ key, title, label }) => <StatsTable key={key} title={title} statLabel={label} players={leaderLists[key].slice(0, 5)} statistic={(player) => formatStatistic(player, key)} />)}</div></>}
        </section>
      </main>
    </PageLayout>
  );
}

export default AwardsPage;
