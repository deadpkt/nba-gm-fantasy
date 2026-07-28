import ActivityTimeline from "../components/activity/ActivityTimeline";
import PageLayout from "../components/PageLayout";
import useLeague from "../hooks/useLeague";

function ActivityPage() {
  const { activeLeague } = useLeague();
  const activities = [];
  const leagueName = activeLeague?.name || "League activity";

  return (
    <PageLayout>
      <div className="activity-page">
        <section className="activity-hero"><div><p className="section-label">LEAGUE INTELLIGENCE</p><h1>Every move.<br /><span>One timeline.</span></h1><p>Stay on top of the moments shaping your league—from new franchises and draft decisions to results, trades, awards, and roster updates.</p></div><div className="activity-hero__ticker"><span>LIVE LEAGUE FEED</span><b>{leagueName}</b><small>ACTIVITY UPDATES WHEN AVAILABLE</small></div></section>
        <section className="activity-panel" aria-labelledby="activity-heading"><header><div><p className="section-label">RECENT LEAGUE EVENTS</p><h2 id="activity-heading">Activity feed</h2></div><span>ALL EVENTS</span></header><ActivityTimeline activities={activities} /></section>
      </div>
    </PageLayout>
  );
}

export default ActivityPage;
