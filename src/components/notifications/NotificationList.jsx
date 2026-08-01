import NotificationCard from "./NotificationCard";
import UiIcon from "../UiIcon";

function NotificationList({ notifications = [], compact = false, onOpen }) {
  if (!notifications.length) return (
    <section className={`notifications-empty ${compact ? "notifications-empty--compact" : ""}`}>
      <div aria-hidden="true"><UiIcon name="bell" size={22} /></div>
      <b>No notifications yet.</b>
      <p>We&apos;ll keep you updated when something important happens.</p>
    </section>
  );
  return <div className="notification-list">{notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} compact={compact} onOpen={onOpen} />)}</div>;
}

export default NotificationList;
