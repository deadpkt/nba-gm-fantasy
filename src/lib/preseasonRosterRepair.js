import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export async function repairPreseasonRoster({ leagueId, dropPlayerId, addPlayerId }) {
  if (!functions) throw new Error("Trusted roster repair is unavailable.");
  return (await httpsCallable(functions, "repairPreseasonRoster")({ leagueId, dropPlayerId: String(dropPlayerId), addPlayerId: String(addPlayerId) })).data;
}
