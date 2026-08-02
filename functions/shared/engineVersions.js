export const RATINGS_VERSION_V1 = 1;
export const RATINGS_VERSION_V2 = 2;
export const SIMULATION_VERSION_V1 = 1;
export const SIMULATION_VERSION_V2 = 2;
export const EVENT_SCHEMA_VERSION_V1 = 1;
export const EVENT_SCHEMA_VERSION_V2 = 2;
export const CONTRACT_MODEL_VERSION_V1 = 1;
export const PLAYER_SNAPSHOT_VERSION_V1 = 1;
export const PLAYER_SNAPSHOT_VERSION_V2 = 2;

export function resolveLeagueEngineVersions(value = {}) {
  const pins = value.engineVersions || value.seasonConfig?.engineVersions || {};
  return {
    ratingsVersion: Number.isInteger(pins.ratingsVersion) ? pins.ratingsVersion : RATINGS_VERSION_V1,
    simulationVersion: Number.isInteger(pins.simulationVersion) ? pins.simulationVersion : SIMULATION_VERSION_V1,
    eventSchemaVersion: Number.isInteger(pins.eventSchemaVersion) ? pins.eventSchemaVersion : EVENT_SCHEMA_VERSION_V1,
    contractModelVersion: Number.isInteger(pins.contractModelVersion) ? pins.contractModelVersion : CONTRACT_MODEL_VERSION_V1,
  };
}

export function validateSimulationVersionPins(value = {}) {
  const pins = resolveLeagueEngineVersions(value);
  if (pins.simulationVersion === SIMULATION_VERSION_V1) return pins;
  if (pins.simulationVersion !== SIMULATION_VERSION_V2 || pins.ratingsVersion !== RATINGS_VERSION_V2 || pins.eventSchemaVersion !== EVENT_SCHEMA_VERSION_V2) {
    throw new Error("Simulation V2 requires Ratings V2 and Event Schema V2 pins.");
  }
  return pins;
}
