const notificationIcons = {
  league_invitation: "◇",
  trade_offer: "⇄",
  match_result: "◆",
  draft_event: "⌁",
  award_received: "★",
  system: "i",
};

function NotificationCard({ notification, compact = false }) {
  const icon = notificationIcons[notification.type] || notificationIcons.system;
  return (
    <article className={`notification-card ${notification.read ? "" : "is-unread"} ${compact ? "notification-card--compact" : ""}`}>
      <div className={`notification-card__icon notification-card__icon--${notification.type || "system"}`} aria-hidden="true">{icon}</div>
      <div className="notification-card__content"><div><b>{notification.title}</b>{!notification.read && <i aria-label="Unread notification" />}</div><p>{notification.description}</p><small>{notification.timestamp}</small></div>
      {notification.action && <button type="button" className="notification-card__action" onClick={notification.action.onClick}>{notification.action.label}</button>}
    </article>
  );
}

export default NotificationCard;
