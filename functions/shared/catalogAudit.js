import { normalizePlayerName, resolveHeadshotEnrichment } from "./nbaCatalog.js";

export function auditCanonicalCatalog(players, headshotLookup) {
  const eligible = players.filter((player) => player.active === true && player.draftEligible === true);
  const byName = new Map();
  eligible.forEach((player) => {
    const key = normalizePlayerName(player.name);
    byName.set(key, [...(byName.get(key) || []), String(player.documentId ?? player.id)]);
  });
  const duplicates = [...byName.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]) => ({ name, ids }));
  const manualOnlyEligible = eligible.filter((player) => player.source?.provider !== "balldontlie" || !Number.isInteger(player.source?.externalId));
  const headshotResolved = eligible.filter((player) => player.nbaPlayerId || player.headshot?.nbaPlayerId || resolveHeadshotEnrichment({ first_name: player.firstName, last_name: player.lastName, team: { abbreviation: player.team } }, headshotLookup)).length;
  return {
    total: players.length,
    eligible: eligible.length,
    duplicates,
    manualOnlyEligible,
    headshotResolved,
    placeholder: eligible.length - headshotResolved,
  };
}
