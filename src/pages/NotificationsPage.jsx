import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationList from "../features/notifications/components/NotificationList";
import PageLayout from "../components/PageLayout";
import useNotifications from "../features/notifications/useNotifications";
import { groupNotifications, notificationRoute } from "../features/notifications/notifications";

function NotificationsPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false), [confirmClear, setConfirmClear] = useState(false), [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  const { notifications, unreadCount, loading, error, markRead, markAllRead, removeNotification, clearAll } = useNotifications({ pageSize: 100, includeSummary: true });
  const groups = groupNotifications(notifications);
  const openNotification = async (notification) => {
    try { await markRead(notification); } catch { return; }
    const route = notificationRoute(notification);
    if (route) navigate(route);
  };
  const action = async (callback) => {
    setBusy(true); setActionError("");
    try { await callback(); }
    catch (requestError) { setActionError(requestError.message || "Notification action failed."); }
    finally { setBusy(false); setMenuOpen(false); }
  };
  return <PageLayout><main className="notifications-page">
    <header className="notifications-page__header"><div><p className="section-label">FRANCHISE ALERTS</p><h1>Notifications</h1><p>Your latest league and social updates.</p></div><div className="notifications-page__tools"><span>{unreadCount ? `${unreadCount} unread` : "No unread notifications"}</span><button type="button" aria-label="Notification actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>•••</button>{menuOpen && <div role="menu"><button type="button" role="menuitem" disabled={!unreadCount || busy} onClick={() => action(markAllRead)}>Mark all as read</button><button type="button" role="menuitem" disabled={!notifications.length || busy} onClick={() => { setMenuOpen(false); setConfirmClear(true); }}>Clear all</button></div>}</div></header>
    {(error || actionError) && <div className="notifications-error" role="alert">{actionError || "Notifications are temporarily unavailable."}</div>}
    {loading ? <div className="notifications-loading">Loading notifications…</div> : groups.length ? groups.map(([label, items]) => <section className="notification-group" key={label} aria-labelledby={`notifications-${label.toLowerCase()}`}><h2 id={`notifications-${label.toLowerCase()}`}>{label}</h2><NotificationList notifications={items} onOpen={openNotification} onMarkRead={(item) => action(() => markRead(item))} onDelete={(item) => action(() => removeNotification(item))} /></section>) : <NotificationList notifications={[]} />}
    {confirmClear && <div className="notification-confirmation"><section role="dialog" aria-modal="true" aria-labelledby="clear-notifications-title"><h2 id="clear-notifications-title">Delete all notifications?</h2><p>This will permanently remove all of your notifications.</p><footer><button type="button" disabled={busy} onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" disabled={busy} onClick={() => action(async () => { await clearAll(); setConfirmClear(false); })}>{busy ? "Deleting…" : "Delete all"}</button></footer></section></div>}
  </main></PageLayout>;
}

export default NotificationsPage;
