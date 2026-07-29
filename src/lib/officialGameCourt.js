const OFFENSE_SPOTS = [
  { x: 52, y: 50 },
  { x: 64, y: 24 },
  { x: 64, y: 76 },
  { x: 73, y: 37 },
  { x: 76, y: 62 },
];

const keyFor = (player) => `${player.side}:${player.playerId}`;
const actorEquals = (player, playerId) =>
  playerId !== null && playerId !== undefined && String(player.playerId) === String(playerId);
const attacksRight = (event, game) => event?.offenseUid === game.homeUid;
const mirror = (spot, right) => ({ x: right ? spot.x : 100 - spot.x, y: spot.y });
const clamp = (value, min = 6, max = 94) => Math.max(min, Math.min(max, value));

function stepToward(current, target, maximumDistance) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (!distance || distance <= maximumDistance) return { x: clamp(target.x), y: clamp(target.y) };
  const ratio = maximumDistance / distance;
  return { x: clamp(current.x + dx * ratio), y: clamp(current.y + dy * ratio) };
}

function openingPositions(players, firstEvent, game) {
  const right = attacksRight(firstEvent, game);
  const offenseSide = right ? "home" : "away";
  const bySide = { home: [], away: [] };
  players.forEach((player) => bySide[player.side].push(player));
  const positions = new Map();
  bySide[offenseSide].forEach((player, index) => {
    positions.set(keyFor(player), mirror(OFFENSE_SPOTS[index], right));
  });
  const defenseSide = offenseSide === "home" ? "away" : "home";
  bySide[defenseSide].forEach((player, index) => {
    const offense = mirror(OFFENSE_SPOTS[index], right);
    positions.set(keyFor(player), {
      x: offense.x + (right ? 3.5 : -3.5),
      y: offense.y + (offense.y < 50 ? 2.5 : -2.5),
    });
  });
  return positions;
}

function applyEvent(scene, players, event, previousEvent, game) {
  const positions = new Map(scene.positions);
  const roles = new Map();
  const right = attacksRight(event, game);
  const offenseSide = right ? "home" : "away";
  const defenseSide = offenseSide === "home" ? "away" : "home";
  const offense = players.filter((player) => player.side === offenseSide);
  const defense = players.filter((player) => player.side === defenseSide);
  const find = (playerId) => players.find((player) => actorEquals(player, playerId));
  const move = (player, target, distance, role = "secondary") => {
    if (!player) return;
    const key = keyFor(player);
    positions.set(key, stepToward(positions.get(key), target, distance));
    roles.set(key, role);
  };
  const hoop = { x: right ? 94 : 6, y: 50 };
  const point = { x: right ? 54 : 46, y: 50 };
  const paint = { x: right ? 86 : 14, y: 50 };
  const wing = mirror(event.sequence % 2 === 0 ? { x: 70, y: 25 } : { x: 70, y: 75 }, right);
  const handler = find(event.playerId);
  const possessionChanged = previousEvent?.offenseUid && previousEvent.offenseUid !== event.offenseUid;

  if (possessionChanged) {
    move(handler, point, 8, "primary");
    const laneRunnerCount = previousEvent.eventType === "steal" ? 2 : 1;
    offense.filter((player) => player !== handler).slice(0, laneRunnerCount).forEach((player, index) => {
      move(player, { x: right ? 52 + index * 3 : 48 - index * 3, y: index ? 68 : 32 }, 4, "transition");
    });
    const priorHandler = find(previousEvent.playerId);
    if (priorHandler) {
      move(priorHandler, { x: right ? 48 : 52, y: positions.get(keyFor(priorHandler))?.y || 50 }, 4, "transition");
    }
  }

  const primaryDefender = find(event.defensivePlayerId) || defense[offense.indexOf(handler)] || defense[0];
  if (["made_3pt", "missed_shot"].includes(event.eventType)) {
    move(handler, wing, 8, "primary");
    move(primaryDefender, { x: wing.x + (right ? 2.5 : -2.5), y: wing.y }, 7, "defender");
  }
  if (["made_2pt", "block", "free_throw"].includes(event.eventType)) {
    const target = event.eventType === "free_throw" ? { x: right ? 76 : 24, y: 50 } : paint;
    move(handler, target, 11, "primary");
    move(primaryDefender, { x: target.x + (right ? 2 : -2), y: target.y + 1.5 }, 9, "defender");
    const help = defense.find((player) => player !== primaryDefender && ["PF", "C"].includes(player.position));
    move(help, { x: right ? 82 : 18, y: 56 }, 3, "secondary");
  }
  if (event.assistPlayerId) {
    const receiver = handler;
    if (receiver) move(receiver, positions.get(keyFor(receiver)), 4, "primary");
    const passer = find(event.assistPlayerId);
    if (passer) roles.set(keyFor(passer), "passer");
  }
  if (event.reboundPlayerId) {
    const rebounder = find(event.reboundPlayerId);
    move(rebounder, paint, 10, "primary");
    players.filter((player) => player !== rebounder && ["PF", "C"].includes(player.position)).forEach((player) => {
      move(player, { x: paint.x + (player.side === offenseSide ? -3 : 3) * (right ? 1 : -1), y: player.position === "C" ? 55 : 44 }, 3, "secondary");
    });
  }
  if (event.eventType === "steal") {
    const thief = find(event.defensivePlayerId);
    move(thief, { x: 50, y: 50 }, 9, "primary");
    move(handler, { x: right ? 54 : 46, y: 53 }, 5, "defender");
  }
  if (event.eventType === "turnover") {
    move(handler, { x: 50, y: 50 }, 5, "primary");
    move(defense[0], { x: right ? 47 : 53, y: 48 }, 6, "primary");
  }

  const actorPosition = handler ? positions.get(keyFor(handler)) : scene.ball.to;
  const assister = find(event.assistPlayerId);
  const rebounder = find(event.reboundPlayerId);
  const thief = find(event.defensivePlayerId);
  let ball = { from: scene.ball.to, via: actorPosition, to: actorPosition, mode: "handle" };
  if (["made_2pt", "made_3pt", "free_throw"].includes(event.eventType)) {
    ball = {
      from: assister ? positions.get(keyFor(assister)) : scene.ball.to,
      via: actorPosition,
      to: hoop,
      mode: "shot",
    };
  } else if (["missed_shot", "block"].includes(event.eventType)) {
    ball = {
      from: scene.ball.to,
      via: hoop,
      to: rebounder ? positions.get(keyFor(rebounder)) : paint,
      mode: rebounder ? "rebound" : "shot",
    };
  } else if (event.eventType === "steal" && thief) {
    ball = { from: scene.ball.to, via: positions.get(keyFor(handler)), to: positions.get(keyFor(thief)), mode: "transfer" };
  } else if (event.eventType === "turnover") {
    ball = { from: scene.ball.to, via: { x: 50, y: 50 }, to: positions.get(keyFor(defense[0])), mode: "transfer" };
  } else if (assister) {
    ball = { from: positions.get(keyFor(assister)), via: actorPosition, to: actorPosition, mode: "pass" };
  }

  return { positions, roles, ball, offenseSide, hoop };
}

export function buildPersistentCourtScene(players, events, game) {
  const firstEvent = events[0];
  let scene = {
    positions: openingPositions(players, firstEvent, game),
    roles: new Map(),
    ball: { from: { x: 50, y: 50 }, via: { x: 50, y: 50 }, to: { x: 50, y: 50 }, mode: "handle" },
    offenseSide: firstEvent?.offenseUid === game.homeUid ? "home" : "away",
  };
  events.forEach((event, index) => {
    scene = applyEvent(scene, players, event, events[index - 1], game);
  });
  return scene;
}

export function eventFeedback(event) {
  if (!event) return null;
  if (event.eventType === "made_3pt") return "+3";
  if (event.eventType === "made_2pt") return "+2";
  if (event.eventType === "free_throw") return "+1";
  if (event.eventType === "steal") return "STEAL";
  if (event.eventType === "block") return "BLOCK";
  if (event.reboundPlayerId) return "REBOUND";
  if (event.eventType === "missed_shot") return "MISS";
  return null;
}
