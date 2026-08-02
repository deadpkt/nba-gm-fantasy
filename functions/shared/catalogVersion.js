export const LEGACY_CATALOG_VERSION = "legacy-current";
export function resolveLeagueCatalogVersion(league = {}) { return typeof league.catalogVersion === "string" && league.catalogVersion ? league.catalogVersion : LEGACY_CATALOG_VERSION; }
export function catalogPlayersPath(league = {}) { const version = resolveLeagueCatalogVersion(league); return `playerCatalogs/${version === LEGACY_CATALOG_VERSION ? "current" : version}/players`; }
