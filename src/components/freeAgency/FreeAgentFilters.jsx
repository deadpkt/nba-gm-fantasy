const POSITIONS = ["ALL", "PG", "SG", "SF", "PF", "C"];

function FreeAgentFilters({ filters, onChange }) {
  return <section className="market-toolbar" aria-label="Free agent filters">
    <label className="market-search"><span>SEARCH</span><input type="search" value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Search free agents" /></label>
    <fieldset className="market-position-filter"><legend>POSITION</legend><div>{POSITIONS.map((position) => <button aria-pressed={filters.position === position} className={filters.position === position ? "is-active" : ""} key={position} onClick={() => onChange({ ...filters, position })} type="button">{position}</button>)}</div></fieldset>
    <label className="market-sort"><span>SORT BY</span><select value={filters.sort} onChange={(event) => onChange({ ...filters, sort: event.target.value })}><option value="overall">OVR — High to Low</option><option value="salary-asc">Salary — Low to High</option><option value="salary-desc">Salary — High to Low</option><option value="name">Name</option><option value="position">Position</option></select></label>
  </section>;
}

export default FreeAgentFilters;
