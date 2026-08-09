import { Link } from "react-router-dom";
import NotificationList from "./NotificationList";

function NotificationDropdown({ notifications = [], unreadCount = 0, loading = false, onOpen, onNavigate }) {
  return (
    <section className="notification-dropdown" aria-label="Notifications">
      <header><div><span>NOTIFICATIONS</span><b>Latest updates</b></div><small>{unreadCount ? `${unreadCount} new` : "All caught up"}</small></header>
      {loading ? <div className="notification-dropdown__loading">Loading updates…</div> : <NotificationList notifications={notifications} compact onOpen={onOpen} />}
      <Link to="/notifications" onClick={onNavigate}>View all notifications <span aria-hidden="true">→</span></Link>
    </section>
  );
}

export default NotificationDropdown;
