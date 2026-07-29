import { Link } from "react-router-dom";
import NotificationList from "./NotificationList";

function NotificationDropdown({ notifications = [], onNavigate }) {
  return (
    <section className="notification-dropdown" aria-label="Notifications">
      <header>
        <div>
          <span>NOTIFICATION CENTER</span>
          <b>Latest updates</b>
        </div>
        <small>
          {notifications.filter((notification) => !notification.read).length
            ? `${notifications.filter((notification) => !notification.read).length} new`
            : "All caught up"}
        </small>
      </header>
      <NotificationList notifications={notifications} compact />
      <Link to="/notifications" onClick={onNavigate}>
        View notification center <span>→</span>
      </Link>
    </section>
  );
}

export default NotificationDropdown;
