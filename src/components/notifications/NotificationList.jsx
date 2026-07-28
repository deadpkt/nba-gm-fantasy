import NotificationCard from "./NotificationCard";

function NotificationList({ notifications = [], compact = false }) {
  if (!notifications.length) {
    return <section className={`notifications-empty ${compact ? "notifications-empty--compact" : ""}`}><div aria-hidden="true">◌</div><b>You’re all caught up.</b><p>League updates, offers, results, and system messages will appear here.</p></section>;
  }
  return <div className="notification-list">{notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} compact={compact} />)}</div>;
}

export default NotificationList;
