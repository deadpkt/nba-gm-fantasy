import { formatMoney, getContractStatus } from "../../lib/contracts";

function ContractCard({ player, contract, teamName, selected, onSelect }) {
  const status = getContractStatus(contract);
  return <button type="button" className={`contract-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(player)}>
    {player.image ? <img src={player.image} alt="" /> : <i aria-hidden="true">{player.position}</i>}
    <div><small>{player.position} · {teamName}</small><b>{player.name}</b><span>{status ? status.replace("_", "-") : "CONTRACT NOT INITIALIZED"}</span></div>
    <strong>{player.overall}<small>OVR</small></strong>
    <em><span>SALARY</span>{formatMoney(contract?.salary)}<small>{contract ? `${contract.yearsRemaining} YEAR${contract.yearsRemaining === 1 ? "" : "S"}` : "YEARS —"}</small></em>
  </button>;
}
export default ContractCard;
