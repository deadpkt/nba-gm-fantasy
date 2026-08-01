const SUPPORTED_LEAGUE_SIZES = Object.freeze([2, 4, 6, 8]);
const PRESET_CYCLES = Object.freeze({ SHORT: 2, STANDARD: 4, FULL: 8 });

export function canLeaveLeagueDynasty(league, actorUid) {
  if (!league || !actorUid) throw new Error("League and member identity are required.");
  if (league.status === "archived") return { allowed: false, reason: "ARCHIVED" };
  if (!["lobby", "offseason"].includes(league.status)) return { allowed: false, reason: "OFFSEASON_REQUIRED" };
  if (!league.memberIds?.includes(actorUid)) return { allowed: false, reason: "NOT_MEMBER" };
  if (league.commissionerUid === actorUid) return { allowed: false, reason: "COMMISSIONER_TRANSFER_REQUIRED" };
  return { allowed: true, reason: null };
}

export function buildDepartingMemberUpdate(league, actorUid, updatedAt) {
  const permission = canLeaveLeagueDynasty(league, actorUid);
  if (!permission.allowed) throw new Error(permission.reason);
  return {
    memberIds: league.memberIds.filter((uid) => uid !== actorUid),
    readyMemberIds: (league.readyMemberIds || []).filter((uid) => uid !== actorUid),
    seasonReadyMemberIds: (league.seasonReadyMemberIds || []).filter((uid) => uid !== actorUid),
    ...(league.offseason ? { offseason: { ...league.offseason, readyMemberIds: (league.offseason.readyMemberIds || []).filter((uid) => uid !== actorUid) } } : {}),
    updatedAt,
  };
}

export function canArchiveLeague(league, actorUid) {
  if (!league || league.commissionerUid !== actorUid) return { allowed: false, reason: "COMMISSIONER_REQUIRED" };
  if (league.status === "archived") return { allowed: true, reason: null, alreadyArchived: true };
  if (league.status !== "offseason") return { allowed: false, reason: "OFFSEASON_REQUIRED" };
  return { allowed: true, reason: null, alreadyArchived: false };
}

export function buildArchiveUpdate(league, actorUid, archivedAt) {
  const permission = canArchiveLeague(league, actorUid);
  if (!permission.allowed) throw new Error(permission.reason);
  return permission.alreadyArchived ? null : { status: "archived", archivedAt, archivedByUid: actorUid, updatedAt: archivedAt };
}

export function resizeSeasonConfig(seasonConfig, memberCount) {
  if (!SUPPORTED_LEAGUE_SIZES.includes(memberCount)) throw new Error("The remaining league needs 2, 4, 6, or 8 franchises before another season can start.");
  const preset = PRESET_CYCLES[seasonConfig?.preset] ? seasonConfig.preset : "STANDARD";
  return { preset, gamesPerTeam: (memberCount - 1) * PRESET_CYCLES[preset], scheduleVersion: 1 };
}
