function ContractCard({ player, teamName, selected, onSelect }) {
  return (
    <button type="button" className={`contract-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(player)}>
      {player.image ? <img src={player.image} alt="" /> : <i aria-hidden="true">{player.position}</i>}
      <div><small>{player.position} · {teamName}</small><b>{player.name}</b><span>Contract details unavailable</span></div>
      <strong>{player.overall}<small>OVR</small></strong>
      <em><span>SALARY</span>—<small>YEARS —</small></em>
    </button>
  );
}

export default ContractCard;
