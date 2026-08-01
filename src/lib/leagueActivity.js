export function activityMillis(activity) {
  const value = activity?.createdAt;
  return value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : Number(value) || 0);
}

export function formatActivityTime(activity, now = Date.now()) {
  const elapsed = Math.max(0, now - activityMillis(activity));
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(activityMillis(activity)));
}

const presentations = {
  league_created: { icon: "league", text: (m) => `${m.actorName || "A GM"} created the league.` },
  member_joined: { icon: "member", text: (m) => `${m.actorName || "A GM"} joined the league.` },
  draft_started: { icon: "draft", text: () => "The league Draft started." },
  draft_completed: { icon: "draft", text: () => "The league Draft is complete." },
  player_drafted: { icon: "draft", text: (m) => `${m.actorName || m.teamName || "A GM"} selected ${m.playerName || "a player"}.` },
  round_started: { icon: "round", text: (m) => `Round ${m.round || ""} started.`.replace("  ", " ") },
  game_finished: { icon: "game", text: (m) => `${m.winnerName || "The winner"} defeated ${m.loserName || "the opponent"}.` },
  free_agent_signed: { icon: "roster", text: (m) => `${m.actorName || m.teamName || "A GM"} signed ${m.playerName || "a player"}.` },
  player_released: { icon: "roster", text: (m) => `${m.actorName || m.teamName || "A GM"} released ${m.playerName || "a player"}.` },
  playoffs_started: { icon: "playoffs", text: () => "The playoffs started." },
  champion_crowned: { icon: "champion", text: (m) => `${m.teamName || "The champion"} won Season ${m.season || ""}.`.replace("  ", " ") },
  season_completed: { icon: "champion", text: (m) => `Season ${m.season || ""} is complete. ${m.championName || "A champion"} finished on top.` },
  offseason_started: { icon: "league", text: (m) => `Season ${m.season || ""} offseason started.` },
  member_left: { icon: "member", text: () => "A GM left the active league." },
  next_season_started: { icon: "league", text: (m) => `Season ${m.season || ""} preparation started.` },
  league_archived: { icon: "league", text: () => "The league was archived." },
};

export function leagueActivityPresentation(activity) {
  const definition = presentations[activity?.type] || { icon: "league", text: () => "League activity updated." };
  return { icon: definition.icon, text: definition.text(activity?.metadata || {}) };
}

export function leagueActivityRoute(activity) {
  if (activity?.type === "game_finished") return "/games";
  if (["champion_crowned", "season_completed"].includes(activity?.type)) return "/league/history";
  return null;
}

const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
export function groupLeagueActivity(activities, now = new Date()) {
  const today = dayStart(now);
  const yesterday = today - 86_400_000;
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  activities.forEach((activity) => {
    const time = activityMillis(activity);
    groups[time >= today ? "Today" : time >= yesterday ? "Yesterday" : "Earlier"].push(activity);
  });
  return Object.entries(groups).filter(([, items]) => items.length);
}
