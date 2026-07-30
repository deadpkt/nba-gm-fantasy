import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export {
  getOfficialParticipantSide,
  OFFICIAL_GAME_STATUS,
} from "./officialGameLifecycle";

export async function startRegularSeasonRound({ leagueId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  const startRound = httpsCallable(functions, "startRegularSeasonRound");
  const response = await startRound({ leagueId });
  return response.data;
}

export async function completeOfficialGame({ leagueId, gameId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  const complete = httpsCallable(functions, "completeOfficialGame");
  const response = await complete({ leagueId, gameId });
  return response.data;
}

export async function finalizeOfficialGamePresentation({ leagueId, gameId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  const finalize = httpsCallable(functions, "finalizeOfficialGamePresentation");
  return (await finalize({ leagueId, gameId })).data;
}

export async function finalizeRegularSeason({ leagueId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  const finalize = httpsCallable(functions, "finalizeRegularSeason");
  const response = await finalize({ leagueId });
  return response.data;
}

export async function initializePlayoffs({ leagueId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  return (await httpsCallable(functions, "initializePlayoffs")({ leagueId })).data;
}

export async function startPlayoffRound({ leagueId }) {
  if (!functions) throw new Error("Official game services are unavailable.");
  return (await httpsCallable(functions, "startPlayoffRound")({ leagueId })).data;
}
