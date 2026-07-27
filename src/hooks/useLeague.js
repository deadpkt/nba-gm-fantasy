import { useContext } from "react";
import { LeagueContext } from "../context/LeagueContext";

export default function useLeague() {
  const leagueContext = useContext(LeagueContext);
  if (!leagueContext)
    throw new Error("useLeague must be used inside LeagueProvider");
  return leagueContext;
}
