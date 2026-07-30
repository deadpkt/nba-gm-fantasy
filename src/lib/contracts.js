import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export * from "../../functions/shared/contracts.js";

export async function initializeLeagueContracts({ leagueId }) {
  if (!functions) throw new Error("Contract services are unavailable.");
  return (await httpsCallable(functions, "initializeLeagueContracts")({ leagueId })).data;
}
