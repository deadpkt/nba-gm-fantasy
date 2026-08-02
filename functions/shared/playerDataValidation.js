import { CANONICAL_POSITIONS } from "./canonicalPlayer.js";

const finding = (severity, code, player, message) => ({ severity, code, playerId: player?.identity?.id || null, playerName: player?.name?.full || null, message });

export function validateCanonicalPlayers(players = [], seasonStats = []) {
  const findings = [];
  const ids = new Map();
  const names = new Map();
  const statsIds = new Set(seasonStats.map((stat) => String(stat.externalPlayerId)));
  players.forEach((player) => {
    const id = player?.identity?.id;
    const name = player?.name?.full?.trim().toLowerCase();
    if (ids.has(id)) findings.push(finding("error", "duplicate-id", player, `Duplicate canonical id also used by ${ids.get(id)}.`));
    else ids.set(id, player?.name?.full || "unknown");
    if (names.has(name)) findings.push(finding("warning", "duplicate-name", player, `Duplicate normalized name also used by ${names.get(name)}.`));
    else names.set(name, id);
    if (!CANONICAL_POSITIONS.includes(player.position) || !player.eligiblePositions?.every((position) => CANONICAL_POSITIONS.includes(position))) findings.push(finding("error", "invalid-position", player, "Position or eligibility is invalid."));
    if (!player.team?.abbreviation) findings.push(finding("warning", "missing-team", player, "Current team is unavailable."));
    if (!player.headshot?.url) findings.push(finding("warning", "missing-image", player, "Headshot is unavailable."));
    const externalId = player.identity?.externalIds?.[0]?.value;
    if (player.status?.active && externalId && !statsIds.has(String(externalId))) findings.push(finding("warning", "missing-stats", player, "Verified season statistics are unavailable."));
    if (!player.status?.active) findings.push(finding("info", "inactive-player", player, "Player is inactive."));
    if (player.status?.retired) findings.push(finding("info", "retired-player", player, "Player is retired."));
    const ratingValues = player.ratings ? [player.ratings.overall, ...Object.values(player.ratings.attributes || {})] : [];
    if (ratingValues.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) findings.push(finding("error", "rating-out-of-bounds", player, "Ratings must be finite values from 0 to 100."));
  });
  return {
    valid: !findings.some((item) => item.severity === "error"),
    findings,
    counts: findings.reduce((counts, item) => ({ ...counts, [item.code]: (counts[item.code] || 0) + 1 }), {}),
  };
}

