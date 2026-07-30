import { formatMoney, getContractStatus } from "../../lib/contracts";

function CapSpacePanel({ player, contract }) {
  const status = getContractStatus(contract);
  return <aside className="cap-space-panel"><header><span>CONTRACT DETAIL</span><b>{player ? player.name : "Player focus"}</b></header>
    {player ? <div className="cap-space-panel__player">{player.image ? <img src={player.image} alt={player.name} /> : <i aria-hidden="true">{player.position}</i>}<div><small>{player.position}</small><b>{player.overall} <span>OVR</span></b></div></div> : <p className="cap-space-panel__select">Select a roster player to review the authoritative contract.</p>}
    <div className="cap-space-panel__details"><div><span>SALARY</span><b>{formatMoney(contract?.salary)}</b></div><div><span>YEARS REMAINING</span><b>{contract ? contract.yearsRemaining : "—"}</b></div><div><span>CONTRACT STATUS</span><b>{status ? status.replace("_", "-") : "NOT INITIALIZED"}</b></div></div>
    <section><span>CONTRACT TIMELINE</span><b>{contract ? `SIGNED SEASON ${contract.signedSeason}` : "Unavailable"}</b><p>Contract years are consumed only when a trusted season enters offseason.</p></section>
    <section><span>PHASE 15 ACCESS</span><b>READ ONLY</b><p>Negotiations, extensions, releases, and signings are not available yet.</p></section>
    <footer><span>FINANCIAL AUTHORITY</span><b>TRUSTED BACKEND</b></footer>
  </aside>;
}
export default CapSpacePanel;
