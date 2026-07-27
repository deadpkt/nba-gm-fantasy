import { useContext } from "react";
import { LeagueTeamContext } from "../context/LeagueTeamContext";

export default function useLeagueTeam() {
  const leagueTeamContext = useContext(LeagueTeamContext);
  if (!leagueTeamContext) {
    throw new Error(
      "useLeagueTeam must be used inside LeagueTeamProvider",
    );
  }
  return leagueTeamContext;
}
