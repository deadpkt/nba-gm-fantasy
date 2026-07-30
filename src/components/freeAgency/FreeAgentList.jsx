import FreeAgentCard from "./FreeAgentCard";

function FreeAgentList({ players, loading, unavailable, onView, onSign, signingPlayerId, contractFor, disabledReasonFor }) {
  if (loading)
    return <div className="free-agency-empty">Loading player catalog...</div>;
  if (unavailable)
    return (
      <div className="free-agency-empty">
        <b>Free-agent availability is unavailable.</b>
        <p>
          Canonical player or league ownership data could not be loaded.
        </p>
      </div>
    );
  if (!players.length)
    return (
      <div className="free-agency-empty">
        <b>No available free agents match these filters.</b>
        <p>Adjust your search or filters to review another market segment.</p>
      </div>
    );
  return (
    <div className="free-agent-list">
      {players.map((player) => (
        <FreeAgentCard key={player.id} player={player} projectedContract={contractFor(player)} onView={onView} onSign={onSign} signing={String(signingPlayerId) === String(player.id)} disabledReason={disabledReasonFor(player)} />
      ))}
    </div>
  );
}

export default FreeAgentList;
