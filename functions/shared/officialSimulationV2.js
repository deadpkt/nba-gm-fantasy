import { EVENT_SCHEMA_VERSION_V2, RATINGS_VERSION_V2, SIMULATION_VERSION_V2 } from "./engineVersions.js";
import { getPlayerDetailedRatings, hasVerifiedRatingsV2 } from "./playerRatingsV2.js";
import { deriveTeamProfile, evaluateStrategyFit, STARTING_POSITIONS } from "./teamIdentity.js";
import { OFFICIAL_PRESENTATION_DURATION_MS } from "./presentationTiming.js";

export const V2_ACTIONS = Object.freeze(["PICK_AND_ROLL", "ISOLATION", "SPOT_UP", "DRIVE", "POST_UP", "CUT", "TRANSITION", "HANDOFF", "OFFENSIVE_REBOUND_PUTBACK"]);
export const V2_SHOT_ZONES = Object.freeze(["RIM", "SHORT_MID", "LONG_MID", "CORNER_THREE", "ABOVE_BREAK_THREE"]);
export const OFFENSIVE_STRATEGIES = Object.freeze(["BALANCED", "PACE_AND_SPACE", "ATTACK_THE_PAINT", "PERIMETER_HEAVY", "PLAY_THROUGH_STAR", "POST_HUB"]);
export const DEFENSIVE_STRATEGIES = Object.freeze(["BALANCED", "PROTECT_THE_PAINT", "PERIMETER_PRESSURE", "SWITCH_EVERYTHING", "DOUBLE_PRIMARY_SCORER", "CRASH_BOARDS"]);
export const V2_GAME_RULES = Object.freeze({ regulationPossessionsPerTeam: 64, minimumPossessionsPerTeam: 58, maximumPossessionsPerTeam: 70, overtimePossessionsPerTeam: 6, maximumOvertimes: 6, maximumSecondChances: 2 });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const idOf = (player) => String(player.playerId ?? player.id);
const round4 = (value) => Math.round(value * 10000) / 10000;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const weightedChoice = (items, weight, random) => {
  const values = items.map((item) => Math.max(.0001, weight(item)));
  let cursor = random() * sum(values);
  for (let index = 0; index < items.length; index += 1) { cursor -= values[index]; if (cursor <= 0) return items[index]; }
  return items.at(-1);
};
export function createV2SeededRandom(seed) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { state ^= seed.charCodeAt(index); state = Math.imul(state, 16777619); }
  return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
}

const normalizeToken = (value) => String(value || "BALANCED").trim().toUpperCase().replace(/[\s-]+/g, "_");
export const normalizeOffensiveStrategy = (value) => OFFENSIVE_STRATEGIES.includes(normalizeToken(value)) ? normalizeToken(value) : "BALANCED";
export const normalizeDefensiveStrategy = (value) => DEFENSIVE_STRATEGIES.includes(normalizeToken(value)) ? normalizeToken(value) : "BALANCED";

function lineupObject(players) { return Object.fromEntries(players.map((player) => [player.assignedPosition || player.position, player])); }
function assertVerifiedLineup(players, side) {
  if (!Array.isArray(players) || players.length !== 5 || players.some((player) => !hasVerifiedRatingsV2(player))) throw new Error(`Simulation V2 requires five verified Ratings V2 ${side} starters.`);
}
const blankPlayerStats = () => ({ points: 0, rebounds: 0, offensiveRebounds: 0, defensiveRebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threesMade: 0, threesAttempted: 0 });
const blankTeamStats = () => ({ points: 0, rebounds: 0, offensiveRebounds: 0, defensiveRebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threesMade: 0, threesAttempted: 0, possessions: 0 });
const snapshotStats = (stats) => Object.fromEntries(Object.entries(stats).map(([id, value]) => [id, { ...value }]));
const deltaStats = (before, after, side) => Object.entries(after).flatMap(([playerId, stats]) => {
  const delta = Object.fromEntries(Object.keys(stats).map((key) => [key, stats[key] - (before[playerId]?.[key] || 0)]));
  return Object.values(delta).some(Boolean) ? [{ playerId, side, ...delta }] : [];
});

export function deriveGameForm(players, random) {
  return Object.fromEntries(players.map((player) => {
    const consistency = getPlayerDetailedRatings(player).consistency;
    const amplitude = 2 + (99 - consistency) / 7;
    return [idOf(player), round4((random() * 2 - 1) * amplitude)];
  }));
}

const ROLE_KEY = { primaryBallHandler: "primaryBallHandler", secondaryCreator: "secondaryCreator", primaryScorer: "primaryScorer", secondaryScorer: "secondaryScorer", floorSpacer: "floorSpacer", rimProtector: "rimProtector", primaryRebounder: "primaryRebounder", perimeterStopper: "perimeterStopper" };
function hasRole(team, playerId, role) { return team.profile.roleAssignments[ROLE_KEY[role]] === playerId; }
function fatigueFor(team, player, progress) {
  const r = getPlayerDetailedRatings(player); const usage = team.profile.usageWeights[idOf(player)] || .2;
  return clamp(progress * (7 + usage * 17 + team.profile.roleConcentration * .035) * (1.12 - r.stamina / 180), 0, 10);
}

export function selectInitiator(team, context, random) {
  return weightedChoice(team.players, (player) => {
    const id = idOf(player); const r = getPlayerDetailedRatings(player); let weight = (team.profile.usageWeights[id] || .2) * 45 + r.playmaking * .12 + r.ballHandling * .1;
    if (hasRole(team, id, "primaryBallHandler")) weight *= 1.75;
    if (hasRole(team, id, "secondaryCreator")) weight *= 1.3;
    if (context.clutch && hasRole(team, id, "primaryScorer")) weight *= 1.25;
    if (team.offenseStrategy === "PLAY_THROUGH_STAR" && hasRole(team, id, "primaryScorer")) weight *= 1.3;
    if (team.offenseStrategy === "POST_HUB" && ["PF", "C"].includes(player.assignedPosition)) weight *= 1.45;
    return weight - fatigueFor(team, player, context.progress) * .8;
  }, random);
}

const ACTION_BASE = { PICK_AND_ROLL: 20, ISOLATION: 11, SPOT_UP: 13, DRIVE: 17, POST_UP: 10, CUT: 10, TRANSITION: 10, HANDOFF: 9 };
export function selectAction(team, opponent, initiator, context, random) {
  return weightedChoice(V2_ACTIONS.slice(0, 8), (action) => {
    let weight = ACTION_BASE[action]; const archetype = team.profile.archetype; const id = idOf(initiator);
    if (action === "TRANSITION") weight *= context.transition ? 2.5 : .55;
    if (action === "PICK_AND_ROLL") weight *= 1 + team.profile.playmaking / 180;
    if (action === "SPOT_UP") weight *= .55 + team.profile.spacing / 100;
    if (action === "DRIVE" || action === "CUT") weight *= .6 + team.profile.rimPressure / 105;
    if (action === "POST_UP") weight *= ["PF", "C"].includes(initiator.assignedPosition) ? 1.35 : .35;
    if (action === "HANDOFF" && ["PF", "C"].includes(initiator.assignedPosition) && (hasRole(team, id, "secondaryCreator") || hasRole(team, id, "primaryBallHandler"))) weight *= 2;
    if (action === "ISOLATION" && hasRole(team, id, "primaryScorer")) weight *= 1.55;
    if (archetype === "PACE_AND_SPACE" && ["PICK_AND_ROLL", "SPOT_UP", "TRANSITION"].includes(action)) weight *= 1.25;
    if (archetype === "PAINT_DOMINANT" && ["DRIVE", "CUT", "POST_UP"].includes(action)) weight *= 1.3;
    if (team.offenseStrategy === "PERIMETER_HEAVY" && ["SPOT_UP", "PICK_AND_ROLL", "HANDOFF"].includes(action)) weight *= 1.35;
    if (team.offenseStrategy === "ATTACK_THE_PAINT" && ["DRIVE", "CUT", "POST_UP"].includes(action)) weight *= 1.4;
    if (team.offenseStrategy === "PLAY_THROUGH_STAR" && action === "ISOLATION") weight *= 1.5;
    if (team.offenseStrategy === "POST_HUB" && ["POST_UP", "HANDOFF"].includes(action)) weight *= 1.55;
    if (opponent.defenseStrategy === "PROTECT_THE_PAINT" && ["DRIVE", "CUT", "POST_UP"].includes(action)) weight *= .8;
    return weight;
  }, random);
}

const ACTION_SHOOTER_WEIGHTS = { PICK_AND_ROLL: { creation: .35, rim: .25, three: .2 }, ISOLATION: { creation: .5, rim: .2, mid: .2 }, SPOT_UP: { spotUp: .7, three: .3 }, DRIVE: { rim: .6, creation: .3 }, POST_UP: { rim: .5, mid: .3 }, CUT: { rim: .75, transition: .15 }, TRANSITION: { transition: .55, rim: .35 }, HANDOFF: { three: .35, creation: .35, spotUp: .2 }, OFFENSIVE_REBOUND_PUTBACK: { rim: 1 } };
export function selectFinisher(team, initiator, action, context, random) {
  const weights = ACTION_SHOOTER_WEIGHTS[action];
  return weightedChoice(team.players, (player) => {
    const id = idOf(player); const tendencies = team.profile.shotTendencies[id]; let weight = (team.profile.usageWeights[id] || .2) * 22 + Object.entries(weights).reduce((total, [key, value]) => total + tendencies[key] * value * 25, 0);
    if (id === idOf(initiator) && ["ISOLATION", "DRIVE", "POST_UP", "PICK_AND_ROLL"].includes(action)) weight *= 1.45;
    if (hasRole(team, id, "primaryScorer")) weight *= context.clutch ? 1.5 : 1.2;
    if (hasRole(team, id, "floorSpacer") && ["SPOT_UP", "HANDOFF"].includes(action)) weight *= 1.35;
    return weight;
  }, random);
}

const ZONE_ACTION_WEIGHTS = {
  PICK_AND_ROLL: { RIM: 34, SHORT_MID: 14, LONG_MID: 7, CORNER_THREE: 18, ABOVE_BREAK_THREE: 27 }, ISOLATION: { RIM: 28, SHORT_MID: 20, LONG_MID: 15, CORNER_THREE: 8, ABOVE_BREAK_THREE: 29 },
  SPOT_UP: { RIM: 4, SHORT_MID: 5, LONG_MID: 6, CORNER_THREE: 39, ABOVE_BREAK_THREE: 46 }, DRIVE: { RIM: 68, SHORT_MID: 17, LONG_MID: 5, CORNER_THREE: 4, ABOVE_BREAK_THREE: 6 },
  POST_UP: { RIM: 58, SHORT_MID: 28, LONG_MID: 10, CORNER_THREE: 1, ABOVE_BREAK_THREE: 3 }, CUT: { RIM: 82, SHORT_MID: 10, LONG_MID: 2, CORNER_THREE: 2, ABOVE_BREAK_THREE: 4 },
  TRANSITION: { RIM: 58, SHORT_MID: 8, LONG_MID: 3, CORNER_THREE: 12, ABOVE_BREAK_THREE: 19 }, HANDOFF: { RIM: 12, SHORT_MID: 14, LONG_MID: 8, CORNER_THREE: 26, ABOVE_BREAK_THREE: 40 },
  OFFENSIVE_REBOUND_PUTBACK: { RIM: 94, SHORT_MID: 6, LONG_MID: 0, CORNER_THREE: 0, ABOVE_BREAK_THREE: 0 },
};
export function selectShotZone(team, opponent, shooter, action, random) {
  const tendency = team.profile.shotTendencies[idOf(shooter)];
  return weightedChoice(V2_SHOT_ZONES, (zone) => {
    let weight = ZONE_ACTION_WEIGHTS[action][zone];
    if (zone === "RIM") weight *= .35 + tendency.rim * 2.7;
    if (["SHORT_MID", "LONG_MID"].includes(zone)) weight *= .4 + tendency.midRange * 2.5;
    if (["CORNER_THREE", "ABOVE_BREAK_THREE"].includes(zone)) weight *= .25 + tendency.threePoint * 3;
    if (team.offenseStrategy === "PERIMETER_HEAVY" && zone.includes("THREE")) weight *= 1.45;
    if (team.offenseStrategy === "ATTACK_THE_PAINT" && zone === "RIM") weight *= 1.45;
    if (opponent.defenseStrategy === "PROTECT_THE_PAINT") weight *= zone === "RIM" ? .75 : zone.includes("THREE") ? 1.2 : 1;
    return weight;
  }, random);
}

function matchupDefender(defense, shooterId) {
  const defenderId = Object.entries(defense.profile.defensiveAssignments).find(([, offensiveId]) => offensiveId === shooterId)?.[0];
  return defense.players.find((player) => idOf(player) === defenderId) || defense.players.find((player) => player.assignedPosition === defense.players.find((candidate) => idOf(candidate) === shooterId)?.assignedPosition) || defense.players[0];
}
export function turnoverProbability({ offense, defense, initiator, defender, action, context }) {
  const handler = getPlayerDetailedRatings(initiator); const guard = getPlayerDetailedRatings(defender);
  const actionRisk = { TRANSITION: .018, ISOLATION: .014, DRIVE: .012, PICK_AND_ROLL: .008, HANDOFF: .004, POST_UP: .005, CUT: .002, SPOT_UP: -.012, OFFENSIVE_REBOUND_PUTBACK: -.02 }[action] || 0;
  const pressure = guard.perimeterDefense * .42 + guard.steal * .34 + defense.profile.perimeterDefense * .24;
  const security = handler.ballHandling * .36 + handler.playmaking * .24 + handler.turnoverControl * .4;
  let probability = .125 + actionRisk + (pressure - security) / 650 + (65 - offense.profile.spacing) / 900 + fatigueFor(offense, initiator, context.progress) / 310;
  if (defense.defenseStrategy === "PERIMETER_PRESSURE") probability += .018;
  if (offense.offenseStrategy === "PACE_AND_SPACE") probability += .006;
  if (context.clutch) probability += (70 - handler.turnoverControl) / 1200;
  return clamp(probability, .055, .225);
}

function selectTurnoverType(action, random) {
  const types = action === "POST_UP" ? [["lost_ball", .42], ["offensive_foul", .28], ["bad_pass", .2], ["shot_clock", .1]] : [["bad_pass", .42], ["lost_ball", .38], ["offensive_foul", .1], ["shot_clock", .1]];
  return weightedChoice(types, (entry) => entry[1], random)[0];
}
export function deriveContest({ offense, defense, shooter, defender, zone, action, context }) {
  const sr = getPlayerDetailedRatings(shooter); const dr = getPlayerDetailedRatings(defender); const rim = zone === "RIM";
  const defenderSkill = rim ? dr.interiorDefense * .6 + dr.athleticism * .2 + defense.profile.rimProtection * .2 : dr.perimeterDefense * .65 + dr.athleticism * .2 + defense.profile.perimeterDefense * .15;
  let creation = sr.ballHandling * .25 + sr.playmaking * .12 + offense.profile.spacing * .25 + (action === "SPOT_UP" ? 10 : action === "ISOLATION" ? 5 : 0);
  if (defense.defenseStrategy === "PROTECT_THE_PAINT") creation += rim ? -9 : 5;
  if (defense.defenseStrategy === "DOUBLE_PRIMARY_SCORER" && hasRole(offense, idOf(shooter), "primaryScorer")) creation -= 9;
  const margin = creation - defenderSkill * .55 - fatigueFor(offense, shooter, context.progress) * 1.2 + offense.form[idOf(shooter)];
  const contestLevel = margin >= 22 ? "OPEN" : margin >= 10 ? "LIGHT" : margin >= -6 ? "CONTESTED" : "HEAVILY_CONTESTED";
  return { contestLevel, creationMargin: clamp(margin, -35, 35) };
}
export function shotMakeProbability({ offense, defense, shooter, defender, zone, contest, context }) {
  const sr = getPlayerDetailedRatings(shooter); const dr = getPlayerDetailedRatings(defender);
  const key = zone === "RIM" ? "rimScoring" : zone.includes("MID") ? "midRange" : "threePoint";
  const base = zone === "RIM" ? .565 : zone === "SHORT_MID" ? .435 : zone === "LONG_MID" ? .395 : zone === "CORNER_THREE" ? .37 : .35;
  const relevantDefense = zone === "RIM" ? dr.interiorDefense * .6 + defense.profile.rimProtection * .4 : dr.perimeterDefense * .75 + defense.profile.perimeterDefense * .25;
  const contestEffect = { OPEN: .075, LIGHT: .025, CONTESTED: -.04, HEAVILY_CONTESTED: -.105 }[contest.contestLevel];
  const fit = (offense.profile.balance - 65) / 1800 + (evaluateStrategyFit(offense.profile, { offense: offense.offenseStrategy }).offense - 65) / 2600;
  const fatigue = fatigueFor(offense, shooter, context.progress) / 420;
  return clamp(base + (sr[key] - 72) / 500 + (sr.consistency - 70) / 1600 - (relevantDefense - 72) / 900 + contestEffect + fit + offense.form[idOf(shooter)] / 680 - fatigue, zone.includes("THREE") ? .18 : .24, zone === "RIM" ? .76 : .61);
}

export function blockProbability({ defense, defender, zone, contest }) {
  if (!["RIM", "SHORT_MID", "LONG_MID"].includes(zone)) return 0;
  const r = getPlayerDetailedRatings(defender); const base = zone === "RIM" ? .055 : zone === "SHORT_MID" ? .025 : .01;
  return clamp(base + (r.block - 65) / 420 + (r.interiorDefense - 70) / 700 + (defense.profile.rimProtection - 70) / 900 + (contest.contestLevel === "HEAVILY_CONTESTED" ? .025 : 0), .005, zone === "RIM" ? .19 : .09);
}
export function assistProbability({ offense, initiator, shooter, action, contest }) {
  if (idOf(initiator) === idOf(shooter) && ["ISOLATION", "DRIVE", "POST_UP"].includes(action)) return .04;
  const r = getPlayerDetailedRatings(initiator); const actionBase = { SPOT_UP: .62, CUT: .62, HANDOFF: .56, PICK_AND_ROLL: .54, TRANSITION: .42, DRIVE: .32, POST_UP: .2, ISOLATION: .08, OFFENSIVE_REBOUND_PUTBACK: 0 }[action];
  return clamp(actionBase + (r.playmaking - 70) / 250 + (offense.profile.spacing - 70) / 600 + (contest.contestLevel === "OPEN" ? .07 : 0), 0, .88);
}

export function reboundSideProbability(offense, defense, zone, blocked) {
  let probability = .245 + (offense.profile.offensiveRebounding - defense.profile.defensiveRebounding) / 320;
  if (zone.includes("THREE")) probability += .025;
  if (blocked) probability -= .035;
  if (offense.offenseStrategy === "PERIMETER_HEAVY") probability -= .025;
  if (defense.defenseStrategy === "CRASH_BOARDS") probability -= .035;
  return clamp(probability, .14, .38);
}
export function selectRebounder(team, type, zone, random) {
  return weightedChoice(team.players, (player) => {
    const r = getPlayerDetailedRatings(player); const position = STARTING_POSITIONS.indexOf(player.assignedPosition);
    const rating = type === "offensive" ? r.offensiveRebounding : r.defensiveRebounding;
    return Math.max(5, rating * .65 + r.athleticism * .15 + position * 3 + (hasRole(team, idOf(player), "primaryRebounder") ? 16 : 0) + (zone.includes("THREE") && position < 3 ? 5 : 0));
  }, random);
}

const actionDuration = (action, random) => {
  const base = { TRANSITION: 10, CUT: 13, DRIVE: 15, SPOT_UP: 16, PICK_AND_ROLL: 18, HANDOFF: 18, ISOLATION: 21, POST_UP: 22, OFFENSIVE_REBOUND_PUTBACK: 7 }[action];
  return clamp(Math.round(base + (random() * 6 - 3)), 5, 24);
};
const clockText = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
const eventText = ({ shooter, initiator, zone, made, turnoverType, rebounder, reboundType, blocker, contest, points }) => {
  if (turnoverType) return turnoverType === "bad_pass" ? `${initiator.name} throws the pass away.` : turnoverType === "offensive_foul" ? `${initiator.name} is called for an offensive foul.` : turnoverType === "shot_clock" ? "The shot clock expires." : `${initiator.name} loses the ball.`;
  if (blocker) return `${blocker.name} blocks ${shooter.name}'s attempt.`;
  if (made) return `${initiator && idOf(initiator) !== idOf(shooter) ? `${initiator.name} finds ` : ""}${shooter.name} makes a ${contest.toLowerCase().replaceAll("_", " ")} ${points === 3 ? "three" : zone === "RIM" ? "shot at the rim" : "jumper"}.`;
  return rebounder ? `${shooter.name} misses; ${rebounder.name} secures the ${reboundType} rebound.` : `${shooter.name} misses the attempt.`;
};

function buildTeam({ uid, name, players, strategy }, opponentPlayers, random) {
  assertVerifiedLineup(players, uid);
  const lineup = lineupObject(players); const opponentLineup = lineupObject(opponentPlayers);
  const profile = deriveTeamProfile(lineup, { opponentLineup });
  const strategyValue = typeof strategy === "object" ? strategy : { offense: strategy, defense: strategy };
  return { uid, name, players, lineup, profile, offenseStrategy: normalizeOffensiveStrategy(strategyValue?.offense), defenseStrategy: normalizeDefensiveStrategy(strategyValue?.defense), form: deriveGameForm(players, random) };
}

function addStat(state, side, playerId, key, amount = 1) { state.playerStats[side][playerId][key] += amount; state.teamStats[side][key] += amount; }
function scoreState(state) { return { home: state.score.home, away: state.score.away }; }
function makeEvent(state, payload, beforeStats) {
  const scoreAfter = scoreState(state);
  const eventType = payload.turnoverType ? (payload.stealer ? "steal" : "turnover") : payload.blocker ? "block" : payload.made ? (payload.points === 3 ? "made_3pt" : payload.points === 1 ? "free_throw" : "made_2pt") : "missed_shot";
  return { eventSchemaVersion: EVENT_SCHEMA_VERSION_V2, eventType, possessionId: payload.possessionId, sequence: state.events.length + 1, quarter: state.quarter, gameClockBefore: payload.clockBefore, gameClock: payload.clockAfter,
    offenseUid: payload.offense.uid, defenseUid: payload.defense.uid, actionType: payload.action, ballHandlerId: idOf(payload.initiator), passerId: payload.passer ? idOf(payload.passer) : null,
    shooterId: payload.shooter ? idOf(payload.shooter) : null, playerId: payload.shooter ? idOf(payload.shooter) : idOf(payload.initiator), primaryDefenderId: payload.defender ? idOf(payload.defender) : null, defensePlayerId: payload.defender ? idOf(payload.defender) : null,
    helpDefenderId: payload.helpDefender ? idOf(payload.helpDefender) : null, shotType: payload.shotValue === 3 ? "THREE_POINT" : payload.shotValue === 2 ? "TWO_POINT" : null, shotZone: payload.zone || null,
    shotValue: payload.shotValue || 0, shotQualityBand: payload.qualityBand || null, contestLevel: payload.contestLevel || null, made: payload.made ?? null,
    turnoverType: payload.turnoverType || null, rebounderId: payload.rebounder ? idOf(payload.rebounder) : null, reboundPlayerId: payload.rebounder ? idOf(payload.rebounder) : null,
    reboundType: payload.reboundType || null, blockerId: payload.blocker ? idOf(payload.blocker) : null, stealerId: payload.stealer ? idOf(payload.stealer) : null,
    points: payload.points || 0, pointsScored: payload.points || 0, scoreBefore: payload.scoreBefore, scoreAfter, homeScore: scoreAfter.home, awayScore: scoreAfter.away,
    statDeltas: [...deltaStats(beforeStats.home, state.playerStats.home, "home"), ...deltaStats(beforeStats.away, state.playerStats.away, "away")], text: payload.text,
    presentation: { kind: payload.turnoverType ? "turnover" : payload.blocker ? "block" : payload.made ? "score" : payload.rebounder ? "rebound" : "miss" },
  };
}

function simulatePossession(state, offense, defense, context, random, rules) {
  const possessionId = state.possessionIndex + 1; let secondChance = 0; let continuation = true; let transition = context.transition;
  while (continuation) {
    continuation = false;
    const beforeStats = { home: snapshotStats(state.playerStats.home), away: snapshotStats(state.playerStats.away) }; const scoreBefore = scoreState(state);
    const localContext = { ...context, transition, progress: Math.min(1, state.possessionIndex / Math.max(1, state.regulationPossessions)), clutch: state.quarter >= 4 && state.clock <= 120 };
    const initiator = secondChance ? context.lastRebounder : selectInitiator(offense, localContext, random);
    const action = secondChance ? "OFFENSIVE_REBOUND_PUTBACK" : selectAction(offense, defense, initiator, localContext, random);
    const initialDefender = defense.players.find((player) => Object.entries(defense.profile.defensiveAssignments).some(([defenderId, offensiveId]) => defenderId === idOf(player) && offensiveId === idOf(initiator))) || defense.players[0];
    const duration = actionDuration(action, random); const clockBefore = clockText(state.clock); state.clock = Math.max(0, state.clock - duration); const clockAfter = clockText(state.clock);
    if (!secondChance && random() < turnoverProbability({ offense, defense, initiator, defender: initialDefender, action, context: localContext })) {
      const turnoverType = selectTurnoverType(action, random); const stolen = ["bad_pass", "lost_ball"].includes(turnoverType) && random() < .7; const stealer = stolen ? initialDefender : null;
      addStat(state, offense.side, idOf(initiator), "turnovers"); if (stealer) addStat(state, defense.side, idOf(stealer), "steals");
      state.events.push(makeEvent(state, { possessionId, offense, defense, action, initiator, defender: initialDefender, turnoverType, stealer, scoreBefore, clockBefore, clockAfter, text: eventText({ initiator, turnoverType }) }, beforeStats));
      transition = stolen; break;
    }
    const shooter = selectFinisher(offense, initiator, action, localContext, random); const defender = matchupDefender(defense, idOf(shooter));
    const zone = selectShotZone(offense, defense, shooter, action, random); const shotValue = zone.includes("THREE") ? 3 : 2;
    const contest = deriveContest({ offense, defense, shooter, defender, zone, action, context: localContext });
    const probability = shotMakeProbability({ offense, defense, shooter, defender, zone, contest, context: localContext });
    addStat(state, offense.side, idOf(shooter), "fieldGoalsAttempted"); if (shotValue === 3) addStat(state, offense.side, idOf(shooter), "threesAttempted");
    const blocked = random() < blockProbability({ defense, defender, zone, contest }); const made = !blocked && random() < probability;
    let passer = null; let rebounder = null; let reboundType = null; let points = 0;
    if (made) {
      points = shotValue; addStat(state, offense.side, idOf(shooter), "points", points); addStat(state, offense.side, idOf(shooter), "fieldGoalsMade"); if (shotValue === 3) addStat(state, offense.side, idOf(shooter), "threesMade"); state.score[offense.side] += points;
      if (random() < assistProbability({ offense, initiator, shooter, action, contest })) { passer = initiator; addStat(state, offense.side, idOf(passer), "assists"); }
    } else {
      if (blocked) addStat(state, defense.side, idOf(defender), "blocks");
      const offensiveBoard = random() < reboundSideProbability(offense, defense, zone, blocked); const reboundTeam = offensiveBoard ? offense : defense; reboundType = offensiveBoard ? "offensive" : "defensive"; rebounder = selectRebounder(reboundTeam, reboundType, zone, random);
      addStat(state, reboundTeam.side, idOf(rebounder), "rebounds"); addStat(state, reboundTeam.side, idOf(rebounder), offensiveBoard ? "offensiveRebounds" : "defensiveRebounds");
      if (offensiveBoard && secondChance < rules.maximumSecondChances) { secondChance += 1; continuation = true; context.lastRebounder = rebounder; transition = false; }
    }
    const qualityBand = probability >= .58 ? "HIGH" : probability >= .43 ? "AVERAGE" : "LOW";
    state.events.push(makeEvent(state, { possessionId, offense, defense, action, initiator, passer, shooter, defender, zone, shotValue, qualityBand, contestLevel: contest.contestLevel, made, blocker: blocked ? defender : null, rebounder, reboundType, points, scoreBefore, clockBefore, clockAfter, text: eventText({ action, shooter, initiator, zone, made, rebounder, reboundType, blocker: blocked ? defender : null, contest: contest.contestLevel, points }) }, beforeStats));
    if (made || !continuation) transition = !made && reboundType === "defensive";
  }
  state.possessionIndex += 1; state.teamStats[offense.side].possessions += 1;
  return transition;
}

function periodBreak(state, type) {
  state.events.push({ eventSchemaVersion: EVENT_SCHEMA_VERSION_V2, possessionId: state.possessionIndex, sequence: state.events.length + 1, quarter: state.quarter, gameClockBefore: "00:00", gameClock: "00:00", eventType: type, points: 0, pointsScored: 0, scoreBefore: scoreState(state), scoreAfter: scoreState(state), homeScore: state.score.home, awayScore: state.score.away, statDeltas: [], text: type === "halftime" ? "Halftime." : `End of ${state.quarter <= 4 ? `Q${state.quarter}` : `OT${state.quarter - 4}`}.`, presentation: { kind: "break" } });
}
function simulatePeriod(state, teams, totalPossessions, seconds, random, rules) {
  state.clock = seconds; const durationTarget = seconds / totalPossessions; let transition = false;
  for (let index = 0; index < totalPossessions; index += 1) {
    const offense = (state.possessionIndex % 2 === 0) ? teams.home : teams.away; const defense = offense === teams.home ? teams.away : teams.home;
    const beforeClock = state.clock; transition = simulatePossession(state, offense, defense, { transition }, random, rules);
    const targetClock = Math.max(0, Math.round(seconds - (index + 1) * durationTarget)); state.clock = Math.min(state.clock, targetClock);
    if (beforeClock === state.clock && state.clock > 0) state.clock -= 1;
  }
  state.clock = 0;
}

function reconcile(state) {
  for (const side of ["home", "away"]) {
    const players = Object.values(state.playerStats[side]); const team = state.teamStats[side];
    for (const key of Object.keys(team).filter((key) => key !== "possessions")) if (sum(players.map((player) => player[key])) !== team[key]) throw new Error(`V2 reconciliation failed for ${side}.${key}.`);
    if (team.points !== state.score[side] || team.assists > team.fieldGoalsMade) throw new Error(`V2 score reconciliation failed for ${side}.`);
  }
  if (state.teamStats.home.steals > state.teamStats.away.turnovers || state.teamStats.away.steals > state.teamStats.home.turnovers) throw new Error("V2 steal reconciliation failed.");
  const missedShots = state.teamStats.home.fieldGoalsAttempted + state.teamStats.away.fieldGoalsAttempted - state.teamStats.home.fieldGoalsMade - state.teamStats.away.fieldGoalsMade;
  const rebounds = state.teamStats.home.rebounds + state.teamStats.away.rebounds;
  if (missedShots !== rebounds || state.teamStats.home.blocks + state.teamStats.away.blocks > missedShots) throw new Error("V2 rebound/block reconciliation failed.");
  return true;
}
function mvpId(state) {
  return ["home", "away"].flatMap((side) => Object.entries(state.playerStats[side]).map(([id, s]) => ({ id, score: s.points + s.rebounds * 1.1 + s.assists * 1.35 + s.steals * 2.2 + s.blocks * 2.2 - s.turnovers * 1.2 - Math.max(0, s.fieldGoalsAttempted - s.fieldGoalsMade) * .18 }))).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0]?.id || null;
}
function compactPlayer(player, stats) { return { playerId: idOf(player), name: player.name, position: player.assignedPosition || player.position, stats }; }
function withPresentationOffsets(events) {
  const interval = OFFICIAL_PRESENTATION_DURATION_MS / Math.max(1, events.length - 1);
  return events.map((event, index) => ({ ...event, presentationOffsetMs: Math.round(index * interval) }));
}

export function simulateOfficialGameV2({ seed, gameIdentity, homeTeam, awayTeam, homePlayers, awayPlayers, gameRules = {} }) {
  assertVerifiedLineup(homePlayers, "home"); assertVerifiedLineup(awayPlayers, "away");
  const rules = { ...V2_GAME_RULES, ...gameRules }; const random = createV2SeededRandom(seed);
  const home = buildTeam({ uid: gameIdentity.homeUid, name: homeTeam.name, players: homePlayers, strategy: homeTeam.strategy }, awayPlayers, random);
  const away = buildTeam({ uid: gameIdentity.awayUid, name: awayTeam.name, players: awayPlayers, strategy: awayTeam.strategy }, homePlayers, random);
  home.side = "home"; away.side = "away";
  const paceScore = (home.profile.athleticism + away.profile.athleticism + (home.offenseStrategy === "PACE_AND_SPACE" ? 10 : 0) + (away.offenseStrategy === "PACE_AND_SPACE" ? 10 : 0)) / 2;
  const perTeam = clamp(Math.round(rules.regulationPossessionsPerTeam + (paceScore - 72) / 5 + (random() * 5 - 2)), rules.minimumPossessionsPerTeam, rules.maximumPossessionsPerTeam);
  const total = perTeam * 2; const state = { score: { home: 0, away: 0 }, events: [], playerStats: { home: Object.fromEntries(homePlayers.map((p) => [idOf(p), blankPlayerStats()])), away: Object.fromEntries(awayPlayers.map((p) => [idOf(p), blankPlayerStats()])) }, teamStats: { home: blankTeamStats(), away: blankTeamStats() }, possessionIndex: 0, regulationPossessions: total, quarter: 1, clock: 720 };
  const base = Math.floor(total / 4); let remaining = total;
  for (let quarter = 1; quarter <= 4; quarter += 1) { state.quarter = quarter; const count = quarter === 4 ? remaining : base; remaining -= count; simulatePeriod(state, { home, away }, count, 720, random, rules); periodBreak(state, quarter === 2 ? "halftime" : "quarter_end"); }
  let overtime = 0;
  while (state.score.home === state.score.away && overtime < rules.maximumOvertimes) { overtime += 1; state.quarter = 4 + overtime; simulatePeriod(state, { home, away }, rules.overtimePossessionsPerTeam * 2, 300, random, rules); periodBreak(state, "overtime_end"); }
  if (state.score.home === state.score.away) {
    const winner = random() < .5 ? home : away; const scorer = winner.players.find((p) => idOf(p) === winner.profile.roleAssignments.primaryScorer) || winner.players[0]; const before = { home: snapshotStats(state.playerStats.home), away: snapshotStats(state.playerStats.away) }; const scoreBefore = scoreState(state);
    addStat(state, winner.side, idOf(scorer), "points"); state.score[winner.side] += 1;
    state.events.push(makeEvent(state, { possessionId: state.possessionIndex + 1, offense: winner, defense: winner === home ? away : home, action: "TIEBREAK_FREE_THROW", initiator: scorer, shooter: scorer, zone: null, shotValue: 1, qualityBand: "TIEBREAK", contestLevel: "OPEN", made: true, points: 1, scoreBefore, clockBefore: "00:00", clockAfter: "00:00", text: `${scorer.name} converts the deciding free throw.` }, before));
  }
  reconcile(state); const homeWon = state.score.home > state.score.away;
  const result = { homeScore: state.score.home, awayScore: state.score.away, winnerUid: homeWon ? home.uid : away.uid, loserUid: homeWon ? away.uid : home.uid };
  state.events.push({ eventSchemaVersion: EVENT_SCHEMA_VERSION_V2, possessionId: state.possessionIndex, sequence: state.events.length + 1, quarter: state.quarter, gameClockBefore: "00:00", gameClock: "00:00", eventType: "game_end", points: 0, pointsScored: 0, scoreBefore: scoreState(state), scoreAfter: scoreState(state), homeScore: result.homeScore, awayScore: result.awayScore, statDeltas: [], text: "Final buzzer. The official game is complete.", presentation: { kind: "final" } });
  const profileSnapshot = (team) => ({ version: team.profile.version, ratingsConfidence: team.profile.ratingsConfidence, overall: team.profile.overall, offense: team.profile.offense, defense: team.profile.defense, balance: team.profile.balance, roleCoverage: team.profile.roleCoverage, starDependency: team.profile.starDependency, archetype: team.profile.archetype, roleAssignments: team.profile.roleAssignments, usageWeights: team.profile.usageWeights });
  const output = { result, timeline: withPresentationOffsets(state.events), boxScore: { version: 2, seedVersion: 2, eventSchemaVersion: 2, home: { uid: home.uid, teamName: home.name, strategy: { offense: home.offenseStrategy, defense: home.defenseStrategy }, teamStats: state.teamStats.home, players: home.players.map((p) => compactPlayer(p, state.playerStats.home[idOf(p)])) }, away: { uid: away.uid, teamName: away.name, strategy: { offense: away.offenseStrategy, defense: away.defenseStrategy }, teamStats: state.teamStats.away, players: away.players.map((p) => compactPlayer(p, state.playerStats.away[idOf(p)])) }, mvpPlayerId: mvpId(state) },
    simulationInput: { simulationVersion: SIMULATION_VERSION_V2, ratingsVersion: RATINGS_VERSION_V2, eventSchemaVersion: EVENT_SCHEMA_VERSION_V2, seed, gameIdentity: { ...gameIdentity }, home: { players: home.players.map((p) => ({ ...p })), profile: profileSnapshot(home), strategy: { offense: home.offenseStrategy, defense: home.defenseStrategy }, form: home.form }, away: { players: away.players.map((p) => ({ ...p })), profile: profileSnapshot(away), strategy: { offense: away.offenseStrategy, defense: away.defenseStrategy }, form: away.form }, rules },
    metrics: { regulationPossessionsPerTeam: perTeam, overtimePeriods: overtime },
  };
  validateSimulationV2Output(output);
  return output;
}

export function serializedV2GameSize(simulation) { return new TextEncoder().encode(JSON.stringify(simulation)).length; }

export function validateSimulationV2Output(simulation) {
  const final = simulation?.timeline?.at(-1);
  if (final?.eventType !== "game_end" || final.homeScore !== simulation.result.homeScore || final.awayScore !== simulation.result.awayScore) throw new Error("V2 timeline score reconciliation failed.");
  if (simulation.result.homeScore === simulation.result.awayScore || ![simulation.boxScore.home.uid, simulation.boxScore.away.uid].includes(simulation.result.winnerUid)) throw new Error("V2 winner reconciliation failed.");
  for (const side of ["home", "away"]) {
    const box = simulation.boxScore[side];
    for (const key of ["points", "rebounds", "assists", "steals", "blocks", "turnovers", "fieldGoalsMade", "fieldGoalsAttempted", "threesMade", "threesAttempted"]) {
      if (sum(box.players.map((player) => player.stats[key])) !== box.teamStats[key]) throw new Error(`V2 box-score reconciliation failed for ${side}.${key}.`);
    }
  }
  if (simulation.timeline.some((event) => event.passerId && (!event.made || event.points <= 0))) throw new Error("V2 assist event reconciliation failed.");
  if (simulation.timeline.some((event) => event.blockerId && !["RIM", "SHORT_MID", "LONG_MID"].includes(event.shotZone))) throw new Error("V2 block event reconciliation failed.");
  return true;
}
