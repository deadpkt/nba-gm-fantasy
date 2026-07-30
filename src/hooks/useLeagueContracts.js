import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import useLeague from "./useLeague";
import useLeagueTeam from "./useLeagueTeam";
import { db } from "../lib/firebase";
import { getLeagueSalaryCap } from "../lib/rosterConfig";
import { getTeamCapSpace, getTeamPayroll, validateTeamContracts } from "../lib/contracts";

export default function useLeagueContracts({ enabled = true } = {}) {
  const { activeLeagueId, activeLeague } = useLeague();
  const { leagueTeam } = useLeagueTeam();
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState("");

  useEffect(() => {
    if (!enabled || !activeLeagueId) { setContracts([]); setContractsLoading(false); return undefined; }
    setContractsLoading(true); setContractsError("");
    return onSnapshot(collection(db, "leagues", activeLeagueId, "contracts"), (snapshot) => {
      setContracts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setContractsLoading(false);
    }, () => { setContracts([]); setContractsError("Contract data is currently unavailable."); setContractsLoading(false); });
  }, [activeLeagueId, enabled]);

  return useMemo(() => {
    const teamContracts = contracts.filter((contract) => contract.ownerUid === leagueTeam?.ownerUid);
    return {
      contracts,
      teamContracts,
      contractsLoading,
      contractsError,
      contractsInitialized: activeLeague?.contractVersion === 1,
      salaryCap: getLeagueSalaryCap(activeLeague),
      payroll: getTeamPayroll(leagueTeam, teamContracts, activeLeague),
      capSpace: getTeamCapSpace(leagueTeam, teamContracts, activeLeague),
      validation: validateTeamContracts(leagueTeam, teamContracts, activeLeague),
    };
  }, [activeLeague, contracts, contractsError, contractsLoading, leagueTeam]);
}
