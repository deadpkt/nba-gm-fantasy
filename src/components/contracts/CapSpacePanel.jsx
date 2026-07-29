function CapSpacePanel({ player }) {
  return (
    <aside className="cap-space-panel">
      <header>
        <span>CONTRACT DETAIL</span>
        <b>{player ? player.name : "Player focus"}</b>
      </header>
      {player ? (
        <div className="cap-space-panel__player">
          {player.image ? (
            <img src={player.image} alt={player.name} />
          ) : (
            <i aria-hidden="true">{player.position}</i>
          )}
          <div>
            <small>{player.position}</small>
            <b>
              {player.overall} <span>OVR</span>
            </b>
          </div>
        </div>
      ) : (
        <p className="cap-space-panel__select">
          Select a roster player to review their contract placeholder.
        </p>
      )}
      <div className="cap-space-panel__details">
        <div>
          <span>SALARY</span>
          <b>Unavailable</b>
        </div>
        <div>
          <span>YEARS REMAINING</span>
          <b>Unavailable</b>
        </div>
        <div>
          <span>CONTRACT STATUS</span>
          <b>Not published</b>
        </div>
      </div>
      <section>
        <span>EXPIRING CONTRACTS</span>
        <b>Unavailable</b>
        <p>Expiring-contract data has not been published.</p>
      </section>
      <section>
        <span>EXTENSIONS</span>
        <b>Unavailable</b>
        <p>
          Extension offers will appear here when contract support is available.
        </p>
      </section>
      <footer>
        <span>LUXURY TAX STATUS</span>
        <b>Unavailable</b>
      </footer>
    </aside>
  );
}

export default CapSpacePanel;
