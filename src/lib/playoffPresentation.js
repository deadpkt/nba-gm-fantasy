import { getPresentationFrame, isOfficialGameFinalVisible } from "./officialGamePresentation.js";

export const PLAYOFF_DISPLAY_STATUS = Object.freeze({
  LIVE: "LIVE",
  FINAL: "FINAL",
  UPCOMING: "UPCOMING",
});

export function playoffDisplayStatus(game, now = Date.now()) {
  if (!game) return PLAYOFF_DISPLAY_STATUS.UPCOMING;
  if (isOfficialGameFinalVisible(game, now)) return PLAYOFF_DISPLAY_STATUS.FINAL;
  if (game.status === "in_progress" || game.timeline?.length) return PLAYOFF_DISPLAY_STATUS.LIVE;
  return PLAYOFF_DISPLAY_STATUS.UPCOMING;
}

export function selectFeaturedPlayoffGame(games = [], uid, now = Date.now()) {
  const active = games.filter((game) => playoffDisplayStatus(game, now) !== PLAYOFF_DISPLAY_STATUS.FINAL);
  const participant = (game) => game.homeUid === uid || game.awayUid === uid;
  return active.find((game) => participant(game))
    || active.find((game) => game.stage === "final")
    || active[0]
    || games.find((game) => game.stage === "final")
    || [...games].reverse().find((game) => participant(game))
    || games.at(-1)
    || null;
}

export function getPlayoffScore(game, now = Date.now()) {
  if (!game) return null;
  if (isOfficialGameFinalVisible(game, now)) return {
    home: game.result?.homeScore,
    away: game.result?.awayScore,
    phase: "FINAL",
    clock: "",
  };
  const event = getPresentationFrame(game, now).currentEvent;
  if (!event) return null;
  return {
    home: event.homeScore ?? 0,
    away: event.awayScore ?? 0,
    phase: event.eventType === "halftime" ? "HALFTIME" : `Q${event.quarter || 1}`,
    clock: event.gameClock || "",
  };
}

export function playoffUserOutcome({ postseason, games = [], uid, now = Date.now() }) {
  if (!uid || !postseason?.qualifiers?.some((team) => team.uid === uid)) return null;
  if (postseason.champion?.uid === uid && postseason.status === "completed") return { state: "champion", label: "CHAMPION", finish: "League Champion" };
  if (postseason.runnerUp?.uid === uid && postseason.status === "completed") return { state: "eliminated", label: "ELIMINATED", finish: "Runner-Up" };
  const lostSemifinal = games.find((game) => game.stage === "semifinal" && isOfficialGameFinalVisible(game, now) && game.result?.loserUid === uid);
  if (lostSemifinal) return { state: "eliminated", label: "ELIMINATED", finish: "Semifinalist" };
  return { state: "active", label: "CHAMPIONSHIP HUNT", finish: "Still Alive" };
}
