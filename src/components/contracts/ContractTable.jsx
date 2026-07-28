import ContractCard from "./ContractCard";

function ContractTable({ roster, teamName, selectedPlayer, onSelect }) {
  return (
    <section className="contract-table">
      <header><div><span>ROSTER CONTRACTS</span><b>Active roster</b></div><small>{roster.length} player{roster.length === 1 ? "" : "s"}</small></header>
      {roster.length ? <div>{roster.map((player) => <ContractCard key={player.id} player={player} teamName={teamName} selected={selectedPlayer?.id === player.id} onSelect={onSelect} />)}</div> : <p className="contract-table__empty">Add players to your franchise to view roster contract placeholders.</p>}
    </section>
  );
}

export default ContractTable;
