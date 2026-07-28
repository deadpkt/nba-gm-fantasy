import NotificationList from "../components/notifications/NotificationList";
import PageLayout from "../components/PageLayout";

function NotificationsPage() {
  const notifications = [];
  return (
    <PageLayout>
      <div className="notifications-page">
        <section className="notifications-hero"><div><p className="section-label">FRANCHISE ALERTS</p><h1>Stay in the <span>game.</span></h1><p>Your league invitations, trade offers, match results, draft events, awards, and platform updates live in one focused command center.</p></div><div className="notifications-hero__signal" aria-hidden="true"><i>◌</i><b>LIVE FEED</b><small>UPDATES WHEN AVAILABLE</small></div></section>
        <section className="notifications-panel" aria-labelledby="notifications-heading"><header><div><p className="section-label">NOTIFICATION CENTER</p><h2 id="notifications-heading">All updates</h2></div><span>NO UNREAD NOTIFICATIONS</span></header><NotificationList notifications={notifications} /></section>
      </div>
    </PageLayout>
  );
}

export default NotificationsPage;
