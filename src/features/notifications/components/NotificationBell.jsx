import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useNotifications from "../useNotifications";
import { notificationRoute } from "../notifications";
import NotificationDropdown from "./NotificationDropdown";
import UiIcon from "../../../components/UiIcon";

function NotificationBell({ onOpen }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead } = useNotifications({ pageSize: 20, includeSummary: true });
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);
  const openNotification = async (notification) => {
    try { await markRead(notification); } catch { /* Firestore listener remains authoritative. */ }
    setOpen(false);
    const route = notificationRoute(notification);
    if (route) navigate(route);
  };
  return <div className="notification-menu" ref={rootRef}>
    <button className="notification-button" type="button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen((value) => !value); onOpen?.(); }}>
      <UiIcon name="bell" size={19}/>{unreadCount > 0 && <b key={unreadCount} className="notification-button__indicator">{unreadCount > 99 ? "99+" : unreadCount}</b>}
    </button>
    {open && <NotificationDropdown notifications={notifications} unreadCount={unreadCount} loading={loading} onOpen={openNotification} onNavigate={() => setOpen(false)} />}
  </div>;
}

export default NotificationBell;
