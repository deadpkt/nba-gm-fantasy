import { groupLeagueActivity } from "../../lib/leagueActivity";
import LeagueActivityItem from "./LeagueActivityItem";

function LeagueActivityFeed({ activities, loading, error }) {
  const groups = groupLeagueActivity(activities);
  return <section className="league-activity" aria-labelledby="league-activity-title">
    <header><div><p className="section-label">LEAGUE ACTIVITY</p><h2 id="league-activity-title">Around the league</h2></div><span>LIVE</span></header>
    {loading ? <div className="league-activity__state">Loading league activity…</div> : error ? <div className="league-activity__state is-error" role="status">{error}</div> : !groups.length ? <div className="league-activity__empty"><i aria-hidden="true">○</i><b>No league activity yet.</b><p>Important league moments will appear here.</p></div> : <div className="league-activity__timeline">{groups.map(([label, items]) => <section key={label}><h3>{label}</h3>{items.map((activity) => <LeagueActivityItem key={activity.id} activity={activity} />)}</section>)}</div>}
  </section>;
}

export default LeagueActivityFeed;
