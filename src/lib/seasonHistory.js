import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export async function enterOffseason({ leagueId }) {
  if (!functions) throw new Error("Season history services are unavailable.");
  return (await httpsCallable(functions, "enterOffseason")({ leagueId })).data;
}

export async function startNextSeason({ leagueId }) {
  if (!functions) throw new Error("Next-season services are unavailable.");
  return (await httpsCallable(functions, "startNextSeason")({ leagueId })).data;
}
