function PlayerInterestPanel({ player }) {
  return (
    <aside className="player-interest-panel">
      <header>
        <span>PLAYER INTEREST</span>
        <b>Scout report</b>
      </header>
      {player ? (
        <>
          <div className="player-interest-panel__player">
            {player.image ? (
              <img src={player.image} alt={player.name} />
            ) : (
              <i aria-hidden="true">{player.position}</i>
            )}
            <div>
              <small>
                {player.position} · {player.team || "FREE AGENT"}
              </small>
              <h2>{player.name}</h2>
              <b>
                {player.overall} <span>OVR</span>
              </b>
            </div>
          </div>
          <div className="player-interest-panel__details">
            <div>
              <span>POSITION</span>
              <b>{player.position}</b>
            </div>
            <div>
              <span>STRENGTHS</span>
              <b>Evaluation unavailable</b>
            </div>
            <div>
              <span>CONTRACT</span>
              <b>Contract terms unavailable</b>
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Free-agent signing is not available yet"
          >
            Sign player <span>Unavailable</span>
          </button>
        </>
      ) : (
        <div className="player-interest-panel__empty">
          <i aria-hidden="true">◈</i>
          <b>Select an available player.</b>
          <p>
            Detailed scouting, contract information, and signing actions will
            appear here when free-agent availability is published.
          </p>
        </div>
      )}
    </aside>
  );
}

export default PlayerInterestPanel;
