import { stripUndefinedValues } from "./nbaCatalog.js";

export const CANONICAL_PLAYER_SCHEMA_VERSION = 1;
export const CANONICAL_POSITIONS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

export function normalizeCanonicalPlayer(input = {}) {
  const id = String(input.identity?.id || "").trim();
  const fullName = String(input.name?.full || "").trim();
  if (!id || !fullName) throw new Error("Canonical player identity and name are required.");
  return stripUndefinedValues({
    schemaVersion: CANONICAL_PLAYER_SCHEMA_VERSION,
    identity: {
      id,
      externalIds: Array.isArray(input.identity.externalIds)
        ? input.identity.externalIds.map((entry) => ({ namespace: String(entry.namespace), value: String(entry.value) }))
        : [],
    },
    name: { full: fullName, first: input.name.first || "", last: input.name.last || "" },
    position: String(input.position || "").toUpperCase(),
    eligiblePositions: [...new Set((input.eligiblePositions || []).map((position) => String(position).toUpperCase()))],
    team: input.team ? { id: input.team.id ?? null, name: input.team.name ?? null, abbreviation: input.team.abbreviation ?? null } : null,
    height: input.height ?? null,
    weight: input.weight ?? null,
    experience: input.experience || {},
    headshot: input.headshot || { url: null },
    status: {
      active: input.status?.active === true,
      draftEligible: input.status?.draftEligible === true,
      retired: input.status?.retired === true,
    },
    ratings: input.ratings ?? null,
    metadata: input.metadata || {},
  });
}

