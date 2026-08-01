import { isOfficialGameFinalVisible, getPresentationFrame } from "./officialGamePresentation.js";

export const GAME_HUB_STATUS = Object.freeze({
  LIVE: "LIVE",
  READY: "READY",
  UPCOMING: "UPCOMING",
  FINAL: "FINAL",
  LOCKED: "LOCKED",
});

const gameOrder = (game) => game?.scheduledOrder ?? game?.gameNumber ?? Number.MAX_SAFE_INTEGER;

export function getHubGameStatus(game, currentRound, now = Date.now()) {
  if (!game) return GAME_HUB_STATUS.UPCOMING;
  if (game.timeline?.length && !isOfficialGameFinalVisible(game, now)) return GAME_HUB_STATUS.LIVE;
  if (isOfficialGameFinalVisible(game, now)) return GAME_HUB_STATUS.FINAL;
  if (game.round > currentRound) return GAME_HUB_STATUS.LOCKED;
  if (game.status === "ready") return GAME_HUB_STATUS.READY;
  if (game.status === "in_progress") return GAME_HUB_STATUS.LIVE;
  return GAME_HUB_STATUS.UPCOMING;
}

export function selectFeaturedGame(games = [], uid, currentRound, now = Date.now()) {
  const userGames = games.filter((game) => game.homeUid === uid || game.awayUid === uid);
  const ordered = [...userGames].sort((a, b) => gameOrder(a) - gameOrder(b));
  return ordered.find((game) => getHubGameStatus(game, currentRound, now) === GAME_HUB_STATUS.LIVE)
    || ordered.find((game) => game.round === currentRound && getHubGameStatus(game, currentRound, now) !== GAME_HUB_STATUS.FINAL)
    || [...ordered].reverse().find((game) => getHubGameStatus(game, currentRound, now) === GAME_HUB_STATUS.FINAL)
    || ordered.find((game) => game.round >= currentRound)
    || ordered.at(-1)
    || null;
}

export function visibleCompletedGames(games = [], now = Date.now()) {
  return games.filter((game) => isOfficialGameFinalVisible(game, now));
}

export function buildSeasonTimeline(games = [], uid, currentRound, now = Date.now()) {
  return games
    .filter((game) => game.homeUid === uid || game.awayUid === uid)
    .sort((a, b) => gameOrder(a) - gameOrder(b))
    .map((game) => {
      const status = getHubGameStatus(game, currentRound, now);
      if (status !== GAME_HUB_STATUS.FINAL) return { game, round: game.round, state: status };
      const won = game.result?.winnerUid === uid;
      const userScore = game.homeUid === uid ? game.result?.homeScore : game.result?.awayScore;
      const opponentScore = game.homeUid === uid ? game.result?.awayScore : game.result?.homeScore;
      return { game, round: game.round, state: won ? "W" : "L", score: `${userScore}-${opponentScore}` };
    });
}

export function deriveMatchupStoryline(game, standings = [], previousGames = [], now = Date.now()) {
  if (!game) return "";
  const home = standings.find((row) => row.teamUid === game.homeUid);
  const away = standings.find((row) => row.teamUid === game.awayUid);
  if (home?.rank <= 2 && away?.rank <= 2 && home.gp > 0 && away.gp > 0) return "A matchup at the top of the league table.";
  const streak = [home, away].find((row) => /^W[3-9]|^W\d{2,}$/.test(row?.streak || ""));
  if (streak) return `${streak.teamName} enters on a ${streak.streak.slice(1)}-game winning streak.`;
  const rematch = previousGames.some((candidate) =>
    candidate.id !== game.id && isOfficialGameFinalVisible(candidate, now) &&
    new Set([candidate.homeUid, candidate.awayUid]).size === 2 &&
    [candidate.homeUid, candidate.awayUid].includes(game.homeUid) &&
    [candidate.homeUid, candidate.awayUid].includes(game.awayUid));
  if (rematch) return "A regular-season rematch.";
  if (home?.gp > 0 && away?.gp > 0 && home.wins === away.wins && home.losses === away.losses) {
    return `Both franchises enter at ${home.wins}-${home.losses}.`;
  }
  return "";
}

export function getVisibleGameScore(game, now = Date.now()) {
  if (!game) return null;
  if (isOfficialGameFinalVisible(game, now)) {
    return { home: game.result?.homeScore, away: game.result?.awayScore, phase: "FINAL", clock: "" };
  }
  if (!game.timeline?.length) return null;
  const event = getPresentationFrame(game, now).currentEvent;
  return event ? {
    home: event.homeScore ?? 0,
    away: event.awayScore ?? 0,
    phase: event.eventType === "halftime" ? "HALFTIME" : `Q${event.quarter || 1}`,
    clock: event.gameClock || "",
  } : { home: 0, away: 0, phase: "Q1", clock: "12:00" };
}

export function getRecentGameLeaders(game, now = Date.now()) {
  if (!game || !isOfficialGameFinalVisible(game, now)) return [];
  const players = [game.boxScore?.away, game.boxScore?.home]
    .filter(Boolean)
    .flatMap((team) => (team.players || []).map((player) => ({ ...player, teamName: team.teamName })));
  return [["points", "Points"], ["rebounds", "Rebounds"], ["assists", "Assists"]].map(([field, label]) => {
    const leader = [...players].sort((a, b) => (b.stats?.[field] || 0) - (a.stats?.[field] || 0))[0];
    return leader ? { field, label, value: leader.stats?.[field] || 0, playerName: leader.name, teamName: leader.teamName } : null;
  }).filter(Boolean);
}
