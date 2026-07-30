import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

function requireFunctions() {
  if (!functions) throw new Error("Free Agency services are unavailable.");
}

export async function signFreeAgent({ leagueId, playerId }) {
  requireFunctions();
  return (await httpsCallable(functions, "signFreeAgent")({ leagueId, playerId: String(playerId) })).data;
}

export async function releaseFreeAgent({ leagueId, playerId }) {
  requireFunctions();
  return (await httpsCallable(functions, "releasePlayer")({ leagueId, playerId: String(playerId) })).data;
}
