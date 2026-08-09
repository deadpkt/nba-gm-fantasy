import { formatNotificationTime, notificationPresentation } from "../notifications";
import UiIcon from "../../../components/UiIcon";

const icons = { person: "userPlus", draft: "clipboard", round: "calendar", result: "games", playoff: "bracket", champion: "trophy", trade: "pen", league: "info" };

function NotificationCard({ notification, compact = false, onOpen, onMarkRead, onDelete }) {
  const presentation = notificationPresentation(notification);
  return (
    <article className={`notification-card ${notification.read ? "" : "is-unread"} ${compact ? "notification-card--compact" : ""}`}>
      <span className={`notification-card__icon notification-card__icon--${presentation.icon}`} aria-hidden="true"><UiIcon name={icons[presentation.icon]} size={18}/></span>
      <button type="button" className="notification-card__content" onClick={() => onOpen?.(notification)}>
        <span><b>{presentation.title}</b>{!notification.read && <i aria-label="Unread notification" />}</span>
        <span className="notification-card__detail">{presentation.detail}</span>
        <small>{formatNotificationTime(notification)}</small>
      </button>
      {!compact && <span className="notification-card__manage">{!notification.read && <button type="button" onClick={() => onMarkRead?.(notification)}>Mark as read</button>}<button type="button" aria-label={`Delete notification: ${presentation.title}`} onClick={() => onDelete?.(notification)}><UiIcon name="trash" size={15}/><span>Delete</span></button></span>}
    </article>
  );
}

export default NotificationCard;
