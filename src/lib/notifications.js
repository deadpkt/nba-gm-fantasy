export const NOTIFICATION_TYPES = Object.freeze([
  "follow", "draft_turn", "round_ready", "game_result", "playoff_started",
  "playoff_qualified", "champion", "trade_offer", "league_activity", "league_lifecycle",
]);

const presentations = {
  follow: { icon: "person", title: (m) => `${m.actorName || "A GM"} followed you`, detail: () => "A new GM joined your network." },
  draft_turn: { icon: "draft", title: () => "You are on the clock", detail: (m) => m.leagueName ? `Make your pick in ${m.leagueName}.` : "Make your draft selection." },
  round_ready: { icon: "round", title: (m) => `Round ${m.round || ""} is ready`.trim(), detail: (m) => m.leagueName ? `${m.leagueName} is ready to continue.` : "Your league is ready to continue." },
  game_result: { icon: "result", title: (m) => m.outcome === "win" ? `You defeated ${m.opponentName || "your opponent"}` : `You lost to ${m.opponentName || "your opponent"}`, detail: (m) => m.score ? `Final score: ${m.score}` : "Your official league game has completed." },
  playoff_started: { icon: "playoff", title: () => "The playoffs have started", detail: (m) => m.leagueName || "The championship race is underway." },
  playoff_qualified: { icon: "playoff", title: () => "Playoff berth secured", detail: (m) => m.teamName ? `${m.teamName} qualified for the playoffs.` : "Your franchise qualified for the playoffs." },
  champion: { icon: "champion", title: () => "League champion", detail: (m) => m.teamName ? `${m.teamName} won the championship.` : "The championship is official." },
  trade_offer: { icon: "trade", title: () => "New trade offer", detail: (m) => m.actorName ? `${m.actorName} sent your franchise an offer.` : "Your franchise received a trade offer." },
  league_activity: { icon: "league", title: () => "League update", detail: (m) => m.summary || "There is new activity in your league." },
  league_lifecycle: { icon: "league", title: (m) => m.event === "league_archived" ? "League archived" : m.event === "next_season_started" ? `Season ${m.season || ""} is ready`.trim() : "Offseason started", detail: (m) => m.leagueName || "Your league lifecycle has advanced." },
};

export function notificationPresentation(notification) {
  const metadata = notification?.metadata || {};
  const presentation = presentations[notification?.type] || presentations.league_activity;
  return { icon: presentation.icon, title: presentation.title(metadata), detail: presentation.detail(metadata) };
}

export function notificationRoute(notification) {
  const route = notification?.metadata?.route;
  return typeof route === "string" && /^\/(?!\/)/.test(route) ? route : null;
}

export function notificationMillis(notification) {
  const value = notification?.createdAt;
  return value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : Number(value) || 0);
}

export function formatNotificationTime(notification, now = Date.now()) {
  const milliseconds = notificationMillis(notification);
  if (!milliseconds) return "Just now";
  const elapsed = Math.max(0, now - milliseconds);
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(milliseconds));
}

const startOfDay = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

export function groupNotifications(notifications, now = new Date()) {
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  notifications.forEach((notification) => {
    const timestamp = notificationMillis(notification);
    const group = timestamp >= today ? "Today" : timestamp >= yesterday ? "Yesterday" : "Earlier";
    groups[group].push(notification);
  });
  return Object.entries(groups).filter(([, items]) => items.length);
}
