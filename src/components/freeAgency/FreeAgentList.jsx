import FreeAgentCard from "./FreeAgentCard";

function FreeAgentList({ players, loading, unavailable, onView }) {
  if (loading)
    return <div className="free-agency-empty">Loading player catalog...</div>;
  if (unavailable)
    return (
      <div className="free-agency-empty">
        <b>Free-agent availability is unavailable.</b>
        <p>
          The current player catalog does not publish free-agent status.
          Available players will appear here when that data is provided.
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
        <FreeAgentCard key={player.id} player={player} onView={onView} />
      ))}
    </div>
  );
}

export default FreeAgentList;
