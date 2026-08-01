import { formatNotificationTime, notificationPresentation } from "../../lib/notifications";
import UiIcon from "../UiIcon";

const icons = { person: "userPlus", draft: "clipboard", round: "calendar", result: "games", playoff: "bracket", champion: "trophy", trade: "pen", league: "info" };

function NotificationCard({ notification, compact = false, onOpen }) {
  const presentation = notificationPresentation(notification);
  return (
    <button type="button" className={`notification-card ${notification.read ? "" : "is-unread"} ${compact ? "notification-card--compact" : ""}`} onClick={() => onOpen?.(notification)}>
      <span className={`notification-card__icon notification-card__icon--${presentation.icon}`} aria-hidden="true"><UiIcon name={icons[presentation.icon]} size={18}/></span>
      <span className="notification-card__content">
        <span><b>{presentation.title}</b>{!notification.read && <i aria-label="Unread notification" />}</span>
        <span className="notification-card__detail">{presentation.detail}</span>
        <small>{formatNotificationTime(notification)}</small>
      </span>
    </button>
  );
}

export default NotificationCard;
