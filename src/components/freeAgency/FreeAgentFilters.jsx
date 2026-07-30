const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];

function FreeAgentFilters({ filters, onChange }) {
  return (
    <section className="free-agent-filters" aria-label="Free agent filters">
      <label className="free-agent-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder="Search available players"
        />
      </label>
      <div className="free-agent-filter-group">
        <span>POSITION</span>
        <div>
          {positions.map((position) => (
            <button
              type="button"
              key={position}
              className={filters.position === position ? "is-active" : ""}
              onClick={() => onChange({ ...filters, position })}
            >
              {position}
            </button>
          ))}
        </div>
      </div>
      <label className="free-agent-select">
        OVR
        <select
          value={filters.rating}
          onChange={(event) =>
            onChange({ ...filters, rating: event.target.value })
          }
        >
          <option value="all">All ratings</option>
          <option value="90">90+ OVR</option>
          <option value="80">80+ OVR</option>
          <option value="70">70+ OVR</option>
        </select>
      </label>
      <label className="free-agent-select">
        SORT
        <select
          value={filters.sort}
          onChange={(event) =>
            onChange({ ...filters, sort: event.target.value })
          }
        >
          <option value="overall">Overall rating</option>
          <option value="salary">Projected salary</option>
          <option value="name">Player name</option>
          <option value="position">Position</option>
        </select>
      </label>
    </section>
  );
}

export default FreeAgentFilters;
