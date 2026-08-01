import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export async function leaveLeagueDynasty(leagueId) {
  if (!functions) throw new Error("League lifecycle services are unavailable.");
  return (await httpsCallable(functions, "leaveLeagueDynasty")({ leagueId })).data;
}

export async function archiveLeague(leagueId) {
  if (!functions) throw new Error("League lifecycle services are unavailable.");
  return (await httpsCallable(functions, "archiveLeague")({ leagueId })).data;
}
