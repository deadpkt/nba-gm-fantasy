import { useCallback, useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import useAuth from "../../hooks/useAuth";
import { db } from "../../lib/firebase";
import { clearNotifications as clearRequest, deleteNotification as deleteRequest, markAllNotificationsRead as markAllRequest, markNotificationRead as markReadRequest } from "./notificationRepository";

export default function useNotifications({ pageSize = 20, includeSummary = false } = {}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [summaryCount, setSummaryCount] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !db) {
      setNotifications([]); setSummaryCount(null); setLoading(false); return undefined;
    }
    setLoading(true); setError("");
    const notificationsQuery = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"), limit(pageSize),
    );
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, (snapshotError) => { setError(snapshotError.message); setLoading(false); });
    return unsubscribe;
  }, [pageSize, user]);

  useEffect(() => {
    if (!includeSummary || !user || !db) { setSummaryCount(null); return undefined; }
    return onSnapshot(doc(db, "users", user.uid, "notificationMeta", "summary"), (snapshot) => {
      setSummaryCount(snapshot.exists() ? Math.max(0, snapshot.data().unreadCount || 0) : 0);
    }, () => setSummaryCount(null));
  }, [includeSummary, user]);

  const markRead = useCallback(async (notification) => {
    if (!notification || notification.read) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    setSummaryCount((current) => current === null ? null : Math.max(0, current - 1));
    try { await markReadRequest(notification.id); }
    catch (readError) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: false } : item));
      setSummaryCount((current) => current === null ? null : current + 1);
      throw readError;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const before = notifications; const previousCount = summaryCount;
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setSummaryCount(0);
    try { return await markAllRequest(); }
    catch (actionError) { setNotifications(before); setSummaryCount(previousCount); throw actionError; }
  }, [notifications, summaryCount]);

  const removeNotification = useCallback(async (notification) => {
    const before = notifications; const previousCount = summaryCount;
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    if (!notification.read) setSummaryCount((current) => current === null ? null : Math.max(0, current - 1));
    try { return await deleteRequest(notification.id); }
    catch (actionError) { setNotifications(before); setSummaryCount(previousCount); throw actionError; }
  }, [notifications, summaryCount]);

  const clearAll = useCallback(async () => {
    const before = notifications; const previousCount = summaryCount;
    setNotifications([]); setSummaryCount(0);
    try { return await clearRequest(); }
    catch (actionError) { setNotifications(before); setSummaryCount(previousCount); throw actionError; }
  }, [notifications, summaryCount]);

  const visibleUnread = notifications.filter((item) => !item.read).length;
  return { notifications, unreadCount: summaryCount ?? visibleUnread, loading, error, markRead, markAllRead, removeNotification, clearAll };
}
