const averageOverall = (players) =>
  players.length
    ? Math.round(
        players.reduce((total, player) => total + player.overall, 0) /
          players.length,
      )
    : 0;
function TradeComparison({ yours, theirs }) {
  const yourOvr = averageOverall(yours);
  const theirOvr = averageOverall(theirs);
  const positions = new Set(
    [...yours, ...theirs].map((player) => player.position),
  );
  return (
    <section className="trade-comparison">
      <header>
        <span>TRADE ANALYSIS</span>
        <b>Offer comparison</b>
      </header>
      <div className="trade-comparison__overall">
        <span>YOUR OFFER</span>
        <strong>{yourOvr || "—"}</strong>
        <i>OVR</i>
        <em>{theirOvr || "—"}</em>
        <span>THEIR OFFER</span>
      </div>
      <div className="trade-comparison__positions">
        <span>POSITION BALANCE</span>
        {positions.size ? (
          [...positions].map((position) => (
            <div key={position}>
              <b>{position}</b>
              <i>
                {yours.filter((player) => player.position === position).length}
              </i>
              <em>
                {theirs.filter((player) => player.position === position).length}
              </em>
            </div>
          ))
        ) : (
          <p>Add players to compare positions.</p>
        )}
      </div>
      <div className="trade-comparison__placeholder">
        <span>SALARY IMPACT</span>
        <b>—</b>
        <small>Salary data is not available.</small>
      </div>
      <div className="trade-comparison__placeholder">
        <span>TRADE VALUE</span>
        <b>—</b>
        <small>Trade evaluation is not available.</small>
      </div>
    </section>
  );
}
export default TradeComparison;
