import NotificationCard from "./NotificationCard";
import UiIcon from "../../../components/UiIcon";

function NotificationList({ notifications = [], compact = false, onOpen, onMarkRead, onDelete }) {
  if (!notifications.length) return (
    <section className={`notifications-empty ${compact ? "notifications-empty--compact" : ""}`}>
      <div aria-hidden="true"><UiIcon name="bell" size={22} /></div>
      <b>You&apos;re all caught up.</b>
      <p>New league and social updates will appear here.</p>
    </section>
  );
  return <div className="notification-list">{notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} compact={compact} onOpen={onOpen} onMarkRead={onMarkRead} onDelete={onDelete} />)}</div>;
}

export default NotificationList;
