export const LEAGUE_ACTIVITY_TYPES = Object.freeze([
  "league_created", "member_joined", "draft_started", "draft_completed",
  "player_drafted", "round_started", "game_finished", "free_agent_signed",
  "player_released", "playoffs_started", "champion_crowned", "season_completed",
  "offseason_started", "member_left", "next_season_started", "league_archived",
]);

const activityTypes = new Set(LEAGUE_ACTIVITY_TYPES);

export function buildLeagueActivityDocument({ type, createdAt, actorUid = null, targetUid = null, gameId = null, metadata = {} }) {
  if (!activityTypes.has(type)) throw new Error(`Unsupported league activity type: ${type}`);
  if (!createdAt) throw new Error("createdAt is required.");
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("metadata must be an object.");
  return { type, createdAt, actorUid, targetUid, gameId, metadata };
}
