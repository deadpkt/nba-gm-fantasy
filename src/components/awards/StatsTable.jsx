function StatsTable({ title, statLabel, players, statistic }) {
  return (
    <section className="leaders-table">
      <header>
        <div>
          <span>LEAGUE LEADERS</span>
          <b>{title}</b>
        </div>
        <small>{statLabel}</small>
      </header>
      {players.length ? (
        <div className="leaders-table__rows">
          {players.map((player, index) => (
            <div className="leaders-table__row" key={player.id}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              {player.image ? (
                <img src={player.image} alt="" />
              ) : (
                <i aria-hidden="true">{player.position}</i>
              )}
              <div>
                <b>{player.name}</b>
                <span>
                  {player.team} · {player.position}
                </span>
              </div>
              <em>
                {statistic(player)} <small>{statLabel}</small>
              </em>
              <mark>{player.overall} OVR</mark>
            </div>
          ))}
        </div>
      ) : (
        <p className="leaders-table__empty">
          This statistic is unavailable in the current player catalog.
        </p>
      )}
    </section>
  );
}

export default StatsTable;
