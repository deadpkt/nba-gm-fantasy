import { useNavigate } from "react-router-dom";
import NotificationList from "../components/notifications/NotificationList";
import PageLayout from "../components/PageLayout";
import useNotifications from "../hooks/useNotifications";
import { groupNotifications, notificationRoute } from "../lib/notifications";

function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, markRead } = useNotifications({ pageSize: 100 });
  const groups = groupNotifications(notifications);
  const openNotification = async (notification) => {
    try { await markRead(notification); } catch { return; }
    const route = notificationRoute(notification);
    if (route) navigate(route);
  };
  return <PageLayout><main className="notifications-page">
    <header className="notifications-page__header"><div><p className="section-label">FRANCHISE ALERTS</p><h1>Notifications</h1><p>Your latest league and social updates.</p></div><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span></header>
    {loading ? <div className="notifications-loading">Loading notifications…</div> : error ? <div className="notifications-error" role="alert">Notifications are temporarily unavailable.</div> : groups.length ? groups.map(([label, items]) => <section className="notification-group" key={label} aria-labelledby={`notifications-${label.toLowerCase()}`}><h2 id={`notifications-${label.toLowerCase()}`}>{label}</h2><NotificationList notifications={items} onOpen={openNotification} /></section>) : <NotificationList notifications={[]} />}
  </main></PageLayout>;
}

export default NotificationsPage;
