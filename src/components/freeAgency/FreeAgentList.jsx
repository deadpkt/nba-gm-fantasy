import FreeAgentRow from "./FreeAgentRow";

function FreeAgentList({
  players,
  loading,
  unavailable,
  noAvailablePlayers,
  onView,
  onSign,
  signingPlayerId,
  contractFor,
  signingStateFor,
  onClear,
}) {
  if (loading)
    return (
      <div
        className="market-list-skeleton"
        aria-label="Loading free agent market"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <p key={index}>
            <i />
            <span />
            <b />
          </p>
        ))}
      </div>
    );
  if (unavailable)
    return (
      <MarketEmpty
        title="MARKET UNAVAILABLE"
        detail="Canonical player or league ownership data could not be loaded."
      />
    );
  if (!players.length)
    return noAvailablePlayers ? (
      <MarketEmpty
        title="NO FREE AGENTS AVAILABLE"
        detail="All eligible players are currently signed."
      />
    ) : (
      <MarketEmpty
        title="NO FREE AGENTS FOUND"
        detail="Try another player name or position."
        action="Clear Filters"
        onAction={onClear}
      />
    );
  return (
    <div className="market-player-list">
      {players.map((player) => (
        <FreeAgentRow
          key={player.id}
          player={player}
          projectedContract={contractFor(player)}
          onView={onView}
          onSign={onSign}
          signingState={signingStateFor(
            player,
            String(signingPlayerId) === String(player.id),
          )}
        />
      ))}
    </div>
  );
}

function MarketEmpty({ title, detail, action, onAction }) {
  return (
    <div className="market-empty">
      <b>{title}</b>
      <p>{detail}</p>
      {action && (
        <button className="button-secondary" onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  );
}

export default FreeAgentList;
