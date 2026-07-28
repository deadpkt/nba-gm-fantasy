import { getLineupOverall } from "../../utils/team";

const normalizeRecord = (record) => ({
  wins: Number.isFinite(record?.wins) ? record.wins : 0,
  losses: Number.isFinite(record?.losses) ? record.losses : 0,
});

function StandingsTable({ members, teams, currentUserId, record, teamName, overall }) {
  const teamByOwner = new Map(teams.map((team) => [team.ownerUid || team.id, team]));
  const standings = members.map((member) => {
    const team = teamByOwner.get(member.uid || member.id);
    const isCurrent = (member.uid || member.id) === currentUserId;
    const teamRecord = isCurrent ? record : normalizeRecord(team?.record);
    const games = teamRecord.wins + teamRecord.losses;
    return {
      id: member.id,
      isCurrent,
      name: isCurrent ? teamName : team?.name || member.displayName || "Franchise",
      record: teamRecord,
      percentage: games ? Math.round((teamRecord.wins / games) * 100) : null,
      overall: isCurrent ? overall : getLineupOverall(team?.roster || [], team?.lineup || {}),
    };
  }).sort((first, second) => second.percentage - first.percentage || second.record.wins - first.record.wins || first.record.losses - second.record.losses || first.name.localeCompare(second.name));

  return (
    <section className="season-standings">
      <header><div><span>LEAGUE STANDINGS</span><b>Season table</b></div><small>Live franchise records</small></header>
      <div className="season-standings__head"><span>RK</span><span>TEAM</span><span>W-L</span><span>WIN%</span><span>OVR</span><span>STATUS</span></div>
      {standings.length ? standings.map((team, index) => <div className={`season-standings__row ${team.isCurrent ? "is-current" : ""}`} key={team.id}><strong>{index + 1}</strong><b>{team.name}</b><span>{team.record.wins}-{team.record.losses}</span><span>{team.percentage === null ? "—" : `${team.percentage}%`}</span><span>{team.overall || "—"}</span><i>{team.isCurrent ? "CURRENT" : "LEAGUE"}</i></div>) : <p className="season-standings__empty">Join a league to see the season table.</p>}
    </section>
  );
}
export default StandingsTable;
