import { LINEUP_POSITIONS } from "../utils/team";

function BasketballCourt({ team, lineup, onAssign }) {
  return (
    <section className="lineup-section">
      <div className="section-heading">
        <div>
          <p className="section-label">LINEUP BOARD</p>
          <h2>
            Set your court <span>Assign every starting position</span>
          </h2>
        </div>
      </div>
      <div className="basketball-court">
        <div className="court-center-circle" aria-hidden="true" />
        {LINEUP_POSITIONS.map((position) => {
          const player = team.find((item) => item.id === lineup[position]);
          return (
            <div
              className={`court-slot court-slot--${position.toLowerCase()}`}
              key={position}
            >
              <span className="court-slot__position">{position}</span>
              {player ? (
                <div
                  className="court-player"
                  style={{ "--player-color": player.color }}
                >
                  <img src={player.image} alt="" />
                  <div>
                    <b>{player.name}</b>
                    <small>
                      {player.overall} OVR / {player.team}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="court-player court-player--empty">
                  <b>Open position</b>
                  <small>Select a player below</small>
                </div>
              )}
              <label className="sr-only" htmlFor={`lineup-${position}`}>
                Assign {position}
              </label>
              <select
                id={`lineup-${position}`}
                value={lineup[position] || ""}
                onChange={(event) =>
                  onAssign(
                    position,
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Unassigned</option>
                {team
                  .filter(
                    (item) =>
                      !Object.entries(lineup).some(
                        ([slot, id]) => slot !== position && id === item.id,
                      ),
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} ({item.overall})
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BasketballCourt;
