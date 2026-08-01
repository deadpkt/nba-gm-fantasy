import ContractCard from "./ContractCard";

function ContractTable({
  roster,
  contracts,
  teamName,
  selectedPlayer,
  onSelect,
}) {
  return (
    <section className="contract-table">
      <header>
        <div>
          <span>TEAM CONTRACTS</span>
          <b>Active roster</b>
        </div>
        <small>{roster.length} players</small>
      </header>
      {roster.length ? (
        <div>
          {roster.map((player) => (
            <ContractCard
              key={player.id}
              player={player}
              contract={contracts.find(
                (contract) => String(contract.playerId) === String(player.id),
              )}
              teamName={teamName}
              selected={selectedPlayer?.id === player.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <p className="contract-table__empty">
          Complete the shared draft to build this franchise roster.
        </p>
      )}
    </section>
  );
}
export default ContractTable;
