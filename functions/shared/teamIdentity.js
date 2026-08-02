import { getPlayerDetailedRatings, getPlayerRatingsVersion, isValidRatingsV2 } from "./playerRatingsV2.js";

export const TEAM_IDENTITY_VERSION = 1;
export const STARTING_POSITIONS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);
export const TEAM_ROLES = Object.freeze([
  "PRIMARY_BALL_HANDLER", "SECONDARY_CREATOR", "PRIMARY_SCORER", "SECONDARY_SCORER",
  "FLOOR_SPACER", "RIM_PRESSURE", "POST_SCORER", "PERIMETER_STOPPER", "RIM_PROTECTOR",
  "PRIMARY_REBOUNDER", "OFFENSIVE_REBOUNDER", "TRANSITION_THREAT",
]);

const clamp = (value, min = 25, max = 99) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(clamp(value));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const weighted = (ratings, weights) => Object.entries(weights).reduce((sum, [key, weight]) => sum + ratings[key] * weight, 0);
const idOf = (player) => String(player?.playerId ?? player?.id ?? "");
const stableSort = (items, scorer, secondary, suitability) => [...items].sort((a, b) =>
  scorer(b) - scorer(a) || secondary(b) - secondary(a) || suitability(b) - suitability(a) || idOf(a).localeCompare(idOf(b)));
const normalizeDistribution = (values) => {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + Math.max(.01, value), 0);
  const result = Object.fromEntries(entries.map(([key, value]) => [key, Math.round((Math.max(.01, value) / total) * 10000) / 10000]));
  const difference = Math.round((1 - Object.values(result).reduce((sum, value) => sum + value, 0)) * 10000) / 10000;
  if (entries.length) result[entries[0][0]] += difference;
  return result;
};

const POSITION_BONUS = {
  PRIMARY_BALL_HANDLER: { PG: 8, SG: 3, SF: 1, PF: -2, C: -3 }, SECONDARY_CREATOR: { PG: 5, SG: 4, SF: 3, PF: 0, C: -1 },
  PRIMARY_SCORER: { PG: 1, SG: 3, SF: 3, PF: 1, C: 1 }, SECONDARY_SCORER: { PG: 1, SG: 3, SF: 3, PF: 2, C: 1 },
  FLOOR_SPACER: { PG: 2, SG: 4, SF: 3, PF: 1, C: -1 }, RIM_PRESSURE: { PG: 0, SG: 1, SF: 2, PF: 4, C: 5 },
  POST_SCORER: { PG: -4, SG: -2, SF: 1, PF: 5, C: 7 }, PERIMETER_STOPPER: { PG: 3, SG: 5, SF: 5, PF: 0, C: -3 },
  RIM_PROTECTOR: { PG: -5, SG: -3, SF: 0, PF: 6, C: 9 }, PRIMARY_REBOUNDER: { PG: -4, SG: -2, SF: 1, PF: 6, C: 9 },
  OFFENSIVE_REBOUNDER: { PG: -4, SG: -2, SF: 1, PF: 6, C: 9 }, TRANSITION_THREAT: { PG: 3, SG: 4, SF: 4, PF: 1, C: -1 },
};
const ROLE_WEIGHTS = {
  PRIMARY_BALL_HANDLER: { playmaking: .32, ballHandling: .29, turnoverControl: .22, stamina: .1, consistency: .07 },
  SECONDARY_CREATOR: { playmaking: .34, ballHandling: .25, turnoverControl: .18, midRange: .08, stamina: .08, consistency: .07 },
  PRIMARY_SCORER: { rimScoring: .22, midRange: .16, threePoint: .21, freeThrow: .08, ballHandling: .12, consistency: .13, athleticism: .08 },
  SECONDARY_SCORER: { rimScoring: .22, midRange: .18, threePoint: .22, freeThrow: .08, ballHandling: .08, consistency: .14, athleticism: .08 },
  FLOOR_SPACER: { threePoint: .65, freeThrow: .1, consistency: .2, stamina: .05 },
  RIM_PRESSURE: { rimScoring: .52, athleticism: .23, ballHandling: .1, freeThrow: .08, consistency: .07 },
  POST_SCORER: { rimScoring: .42, midRange: .18, offensiveRebounding: .12, athleticism: .12, consistency: .16 },
  PERIMETER_STOPPER: { perimeterDefense: .48, steal: .18, athleticism: .18, stamina: .1, consistency: .06 },
  RIM_PROTECTOR: { interiorDefense: .42, block: .27, defensiveRebounding: .13, athleticism: .1, consistency: .08 },
  PRIMARY_REBOUNDER: { defensiveRebounding: .51, offensiveRebounding: .2, athleticism: .16, stamina: .07, consistency: .06 },
  OFFENSIVE_REBOUNDER: { offensiveRebounding: .58, defensiveRebounding: .13, athleticism: .18, stamina: .06, consistency: .05 },
  TRANSITION_THREAT: { athleticism: .34, stamina: .18, rimScoring: .26, ballHandling: .12, steal: .1 },
};

export function validateStartingFive(lineup) {
  if (!lineup || typeof lineup !== "object") return { valid: false, errors: ["invalid_lineup"] };
  const players = STARTING_POSITIONS.map((position) => lineup[position]);
  const errors = [];
  STARTING_POSITIONS.forEach((position, index) => { if (!players[index]) errors.push(`missing_${position.toLowerCase()}`); });
  const ids = players.filter(Boolean).map(idOf);
  if (ids.some((id) => !id) || players.filter(Boolean).some((player) => !String(player.name || "").trim())) errors.push("invalid_player_snapshot");
  if (new Set(ids).size !== ids.length) errors.push("duplicate_starter");
  players.filter(Boolean).forEach((player) => {
    if (player.ratingsVersion === 2 && !isValidRatingsV2(player.ratings)) errors.push(`malformed_ratings:${idOf(player)}`);
  });
  return { valid: errors.length === 0, errors };
}

export function derivePlayerRoleScores(lineup) {
  return Object.fromEntries(STARTING_POSITIONS.map((assignedPosition) => {
    const player = lineup[assignedPosition];
    const ratings = getPlayerDetailedRatings(player);
    const scores = Object.fromEntries(TEAM_ROLES.map((role) => [role, round(weighted(ratings, ROLE_WEIGHTS[role]) + (POSITION_BONUS[role][assignedPosition] || 0))]));
    return [idOf(player), scores];
  }));
}

export function assignLineupRoles(lineup, roleScores = derivePlayerRoleScores(lineup)) {
  const players = STARTING_POSITIONS.map((position) => ({ ...lineup[position], assignedPosition: position }));
  const pick = (role, excluded = null, tolerance = 7) => {
    const ranked = stableSort(players, (p) => roleScores[idOf(p)][role], (p) => getPlayerDetailedRatings(p)[Object.keys(ROLE_WEIGHTS[role])[0]], (p) => POSITION_BONUS[role][p.assignedPosition] || 0);
    return excluded && ranked[0] && idOf(ranked[0]) === excluded && ranked[1] && roleScores[idOf(ranked[0])][role] - roleScores[idOf(ranked[1])][role] <= tolerance ? ranked[1] : ranked[0];
  };
  const primaryBallHandler = pick("PRIMARY_BALL_HANDLER");
  const primaryScorer = pick("PRIMARY_SCORER");
  const assignments = {
    primaryBallHandler: idOf(primaryBallHandler), secondaryCreator: idOf(pick("SECONDARY_CREATOR", idOf(primaryBallHandler))),
    primaryScorer: idOf(primaryScorer), secondaryScorer: idOf(pick("SECONDARY_SCORER", idOf(primaryScorer))),
    floorSpacer: idOf(pick("FLOOR_SPACER")), perimeterStopper: idOf(pick("PERIMETER_STOPPER")),
    rimProtector: idOf(pick("RIM_PROTECTOR")), primaryRebounder: idOf(pick("PRIMARY_REBOUNDER")),
  };
  const playerRoles = Object.fromEntries(players.map((player) => [idOf(player), []]));
  Object.entries(assignments).forEach(([role, playerId]) => playerRoles[playerId].push(role));
  return { roleAssignments: assignments, playerRoles };
}

export function deriveUsageHierarchy(lineup, roleAssignments) {
  const raw = {};
  STARTING_POSITIONS.forEach((position) => {
    const player = lineup[position]; const id = idOf(player); const r = getPlayerDetailedRatings(player);
    let value = r.rimScoring * .18 + r.midRange * .12 + r.threePoint * .18 + r.playmaking * .14 + r.ballHandling * .12 + r.consistency * .13 + r.stamina * .13;
    if (roleAssignments.primaryScorer === id) value *= 1.16;
    if (roleAssignments.primaryBallHandler === id) value *= 1.09;
    if (roleAssignments.secondaryScorer === id || roleAssignments.secondaryCreator === id) value *= 1.06;
    raw[id] = clamp(value, 35, 115);
  });
  return normalizeDistribution(raw);
}

export function deriveShotTendencies(lineup) {
  return Object.fromEntries(STARTING_POSITIONS.map((position) => {
    const player = lineup[position]; const r = getPlayerDetailedRatings(player);
    const interior = ["PF", "C"].includes(position) ? 1.12 : 1;
    return [idOf(player), normalizeDistribution({
      rim: r.rimScoring * interior, midRange: r.midRange * .75, threePoint: r.threePoint * (["SG", "SF"].includes(position) ? 1.12 : 1),
      creation: (r.playmaking + r.ballHandling) / 2, spotUp: r.threePoint * .82 + r.consistency * .18, transition: r.athleticism * .72 + r.stamina * .28,
    })];
  }));
}

const topAverage = (values, count) => mean([...values].sort((a, b) => b - a).slice(0, count));
const lowAverage = (values, count) => mean([...values].sort((a, b) => a - b).slice(0, count));
const profileMetric = (players, key) => players.map((player) => getPlayerDetailedRatings(player)[key]);

export function deriveLineupFit(lineup, roleScores) {
  const players = STARTING_POSITIONS.map((position) => lineup[position]);
  const max = (role) => Math.max(...players.map((player) => roleScores[idOf(player)][role]));
  const second = (role) => [...players.map((player) => roleScores[idOf(player)][role])].sort((a, b) => b - a)[1];
  const functions = {
    ball_handling: max("PRIMARY_BALL_HANDLER"), shot_creation: (max("PRIMARY_SCORER") + second("SECONDARY_CREATOR")) / 2,
    shooting_spacing: (max("FLOOR_SPACER") + second("FLOOR_SPACER")) / 2, rim_pressure: max("RIM_PRESSURE"),
    perimeter_defense: max("PERIMETER_STOPPER"), interior_defense: max("RIM_PROTECTOR"),
    rebounding: max("PRIMARY_REBOUNDER"), rim_protection: max("RIM_PROTECTOR"),
  };
  const balance = round(mean(Object.values(functions)) - Math.max(0, 62 - Math.min(...Object.values(functions))) * .45);
  const missingRoles = [];
  if (functions.ball_handling < 60) missingRoles.push("primary_creation");
  if (second("SECONDARY_CREATOR") < 58) missingRoles.push("secondary_creation");
  if (functions.shooting_spacing < 59) missingRoles.push("floor_spacing");
  if (functions.perimeter_defense < 58) missingRoles.push("perimeter_defense");
  if (functions.rim_protection < 58) missingRoles.push("rim_protection");
  if (functions.rebounding < 58) missingRoles.push("rebounding");
  return { balance, roleCoverage: round(99 - missingRoles.length * 10 - Math.max(0, 60 - mean(Object.values(functions))) * .45), missingRoles, functions };
}

export function deriveTeamArchetype(profile) {
  if (profile.starDependency >= 76 && profile.balance < 70) return "STAR_CENTRIC";
  if (profile.defense >= 80 && profile.rimProtection >= 80) return "DEFENSIVE_ANCHOR";
  if (profile.defense >= 79 && profile.perimeterDefense >= 78 && profile.athleticism >= 74) return "SWITCHABLE_DEFENSE";
  if (profile.spacing >= 79 && profile.playmaking >= 74 && profile.athleticism >= 70) return "PACE_AND_SPACE";
  if (profile.shooting >= 81 && profile.spacing >= 75) return "PERIMETER_OFFENSE";
  if (profile.rimPressure >= 81 && profile.offensiveRebounding >= 72) return "PAINT_DOMINANT";
  if (profile.playmaking >= 82) return "PLAYMAKING_HUB";
  if (profile.rebounding >= 82) return "REBOUNDING_POWERHOUSE";
  if (profile.offense >= 83) return "OFFENSIVE_FIREPOWER";
  if (profile.defense >= 82 && profile.offense < 75) return "DEFENSIVE_GRIND";
  return "BALANCED";
}

const positionDistance = (a, b) => Math.abs(STARTING_POSITIONS.indexOf(a) - STARTING_POSITIONS.indexOf(b));
const permutations = (items) => items.length <= 1 ? [items] : items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map((rest) => [item, ...rest]));
export function deriveDefensiveAssignments(defenseLineup, offenseLineup) {
  const defenders = STARTING_POSITIONS.map((position) => ({ player: defenseLineup[position], position }));
  const threats = STARTING_POSITIONS.map((position) => ({ player: offenseLineup[position], position }));
  const assignments = permutations(threats).map((ordered) => {
    const cost = ordered.reduce((sum, threat, index) => {
      const defender = defenders[index]; const dr = getPlayerDetailedRatings(defender.player); const or = getPlayerDetailedRatings(threat.player);
      const interiorThreat = threat.position === "PF" || threat.position === "C";
      const defense = interiorThreat ? dr.interiorDefense * .55 + dr.block * .25 : dr.perimeterDefense * .55 + dr.steal * .2;
      const threatScore = interiorThreat ? or.rimScoring : or.threePoint * .55 + or.ballHandling * .25;
      return sum + positionDistance(defender.position, threat.position) * 10 + Math.max(0, threatScore - defense) * .35;
    }, 0);
    return { ordered, cost, key: ordered.map(({ player }) => idOf(player)).join("|") };
  }).sort((a, b) => a.cost - b.cost || a.key.localeCompare(b.key))[0];
  return Object.fromEntries(defenders.map((defender, index) => [idOf(defender.player), idOf(assignments.ordered[index].player)]));
}

export function deriveTeamProfile(lineup, { opponentLineup = null } = {}) {
  const validation = validateStartingFive(lineup);
  if (!validation.valid) return { valid: false, version: TEAM_IDENTITY_VERSION, errors: validation.errors, warnings: validation.errors };
  const players = STARTING_POSITIONS.map((position) => lineup[position]);
  const roleScores = derivePlayerRoleScores(lineup);
  const { roleAssignments, playerRoles } = assignLineupRoles(lineup, roleScores);
  const usageWeights = deriveUsageHierarchy(lineup, roleAssignments);
  const shotTendencies = deriveShotTendencies(lineup);
  const fit = deriveLineupFit(lineup, roleScores);
  const values = (key) => profileMetric(players, key);
  const scoring = players.map((player) => roleScores[idOf(player)].PRIMARY_SCORER);
  const shooting = round(mean(values("threePoint")) * .6 + topAverage(values("threePoint"), 3) * .4);
  const credibleShooters = values("threePoint").filter((value) => value >= 66).length;
  const spacing = round(shooting * .58 + (credibleShooters / 5) * 32 + roleScores[roleAssignments.floorSpacer].FLOOR_SPACER * .1 - Math.max(0, 2 - credibleShooters) * 5);
  const playmaking = round(roleScores[roleAssignments.primaryBallHandler].PRIMARY_BALL_HANDLER * .5 + roleScores[roleAssignments.secondaryCreator].SECONDARY_CREATOR * .3 + topAverage(values("ballHandling"), 3) * .2);
  const rimPressure = round(topAverage(values("rimScoring"), 2) * .7 + mean(values("rimScoring")) * .3);
  const turnoverSecurity = round(topAverage(values("turnoverControl"), 3) * .7 + mean(values("turnoverControl")) * .3);
  const offensiveRebounding = round(topAverage(values("offensiveRebounding"), 2) * .68 + mean(values("offensiveRebounding")) * .32);
  const defensiveRebounding = round(topAverage(values("defensiveRebounding"), 2) * .68 + mean(values("defensiveRebounding")) * .32);
  const rebounding = round(offensiveRebounding * .38 + defensiveRebounding * .62);
  const perimeterDefense = round(mean(values("perimeterDefense")) * .58 + topAverage(values("perimeterDefense"), 2) * .27 + lowAverage(values("perimeterDefense"), 2) * .15);
  const interiorDefense = round(mean(values("interiorDefense")) * .55 + topAverage(values("interiorDefense"), 2) * .3 + lowAverage(values("interiorDefense"), 2) * .15);
  const rimProtection = round(roleScores[roleAssignments.rimProtector].RIM_PROTECTOR * .58 + topAverage(values("block"), 2) * .25 + interiorDefense * .17);
  const athleticism = round(mean(values("athleticism"))); const stamina = round(mean(values("stamina"))); const consistency = round(mean(values("consistency")));
  const talent = round(mean(values("overall")));
  const sortedUsage = Object.values(usageWeights).sort((a, b) => b - a);
  const roleConcentration = round(25 + Math.max(...Object.values(playerRoles).map((roles) => roles.length)) * 12 + Math.max(0, sortedUsage[0] - sortedUsage[1]) * 100);
  const starDependency = round(roleConcentration * .45 + 25 + (sortedUsage[0] - .2) * 125 + Math.max(0, 70 - fit.roleCoverage) * .2);
  const offense = round(topAverage(scoring, 2) * .26 + playmaking * .18 + spacing * .16 + rimPressure * .12 + turnoverSecurity * .1 + fit.roleCoverage * .08 + talent * .16 + lowAverage(scoring, 2) * .06 - Math.max(0, starDependency - 75) * .06);
  const defense = round(perimeterDefense * .24 + interiorDefense * .21 + rimProtection * .19 + defensiveRebounding * .15 + mean(values("steal")) * .07 + mean(values("block")) * .06 + lowAverage([...values("perimeterDefense"), ...values("interiorDefense")], 3) * .08);
  const overall = round(offense * .48 + defense * .42 + fit.balance * .1);
  const versions = players.map(getPlayerRatingsVersion); const verifiedCount = versions.filter((version) => version === 2).length;
  const ratingsConfidence = verifiedCount === 5 ? "verified" : verifiedCount === 0 ? "legacy" : "mixed";
  const warnings = [];
  if (ratingsConfidence === "legacy") warnings.push("ratings_data_limited");
  if (ratingsConfidence === "mixed") warnings.push("mixed_ratings_versions");
  if (fit.missingRoles.includes("primary_creation")) warnings.push("no_viable_ball_handler");
  if (fit.missingRoles.includes("rim_protection")) warnings.push("no_rim_protector");
  if (spacing < 55) warnings.push("very_poor_spacing");
  if (rebounding < 55) warnings.push("very_poor_rebounding");
  const profile = { valid: true, version: TEAM_IDENTITY_VERSION, ratingsConfidence, versionComposition: { v1: 5 - verifiedCount, v2: verifiedCount }, warnings,
    overall, talent, offense, defense, shooting, playmaking, rimPressure, spacing, turnoverSecurity, rebounding, offensiveRebounding, defensiveRebounding,
    perimeterDefense, interiorDefense, rimProtection, athleticism, stamina, consistency, balance: fit.balance, roleCoverage: fit.roleCoverage,
    roleConcentration, starDependency, archetype: null, primaryStrength: null, primaryWeakness: null, missingRoles: fit.missingRoles,
    roleAssignments, playerRoles, usageWeights, shotTendencies, defensiveAssignments: opponentLineup && validateStartingFive(opponentLineup).valid ? deriveDefensiveAssignments(lineup, opponentLineup) : {},
  };
  profile.archetype = deriveTeamArchetype(profile);
  const strengths = [["elite_shooting", shooting], ["strong_playmaking", playmaking], ["rim_pressure", rimPressure], ["perimeter_defense", perimeterDefense], ["interior_defense", interiorDefense], ["rebounding", rebounding], ["turnover_security", turnoverSecurity]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  profile.primaryStrength = strengths[0][1] >= 72 ? strengths[0][0] : null;
  const weaknesses = [["poor_spacing", spacing], ["weak_rim_protection", rimProtection], ["limited_creation", playmaking], ["weak_rebounding", rebounding], ["defensive_mismatch", Math.min(perimeterDefense, interiorDefense)], ["star_dependency", 124 - starDependency]].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  profile.primaryWeakness = weaknesses[0][1] < 58 ? weaknesses[0][0] : null;
  return profile;
}

export function evaluateStrategyFit(profile, { offense = "BALANCED", defense = "BALANCED" } = {}) {
  const offensive = { BALANCED: profile.balance, PACE_AND_SPACE: mean([profile.spacing, profile.playmaking, profile.athleticism]), ATTACK_THE_PAINT: mean([profile.rimPressure, profile.offensiveRebounding]), PERIMETER_HEAVY: mean([profile.shooting, profile.spacing]), PLAY_THROUGH_STAR: mean([profile.talent, profile.starDependency]), POST_HUB: mean([profile.rimPressure, profile.playmaking, profile.interiorDefense]) };
  const defensive = { BALANCED: profile.balance, PROTECT_THE_PAINT: mean([profile.interiorDefense, profile.rimProtection]), PERIMETER_PRESSURE: mean([profile.perimeterDefense, profile.athleticism]), SWITCH_EVERYTHING: mean([profile.perimeterDefense, profile.athleticism, profile.balance]), DOUBLE_PRIMARY_SCORER: mean([profile.perimeterDefense, profile.stamina]), CRASH_BOARDS: mean([profile.rebounding, profile.athleticism]) };
  return { offense: round(offensive[offense] ?? offensive.BALANCED), defense: round(defensive[defense] ?? defensive.BALANCED), active: false };
}
