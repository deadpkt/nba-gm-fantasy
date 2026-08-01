import { Link } from "react-router-dom";
import { formatGamesBehind, gamesBehind } from "../../lib/standingsRace";

const initials = (name = "Team") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const formatPct = (value) => value.toFixed(3).replace(/^0/, "");

export function StandingsHeader({ league, qualifierCount, finalTable }) {
  const round = league?.seasonProgress?.currentRound;
  return <header className="race-header"><div><span>FULL COURT LEAGUE RACE</span><h1>{finalTable ? "Final Standings" : "Standings"}</h1></div><p>Season {league?.season} <i /> {finalTable ? "Final Regular Season" : "Regular Season"}{round ? <><i /> Round {round}</> : null}</p><small>Top {qualifierCount} qualify for the playoffs</small></header>;
}

export function MyStandingSummary({ row, leader, qualifierCount }) {
  if (!row) return null;
  const inPosition = row.rank <= qualifierCount;
  return <section className="my-standing"><div><span>YOUR FRANCHISE</span><h2><i>#{row.rank}</i>{row.teamName}</h2></div><dl><div><dt>Record</dt><dd>{row.wins}-{row.losses}</dd></div><div><dt>Games Behind</dt><dd>{formatGamesBehind(gamesBehind(leader, row), row.rank === 1)}</dd></div><div><dt>Playoff Position</dt><dd className={inPosition ? "is-in" : "is-out"}>{inPosition ? "IN" : "OUT"}</dd></div><div><dt>Streak</dt><dd>{row.streak}</dd></div></dl></section>;
}

export function StandingsTable({ rows, currentUid, members, qualifierCount, finalTable }) {
  const leader = rows[0];
  const memberMap = new Map(members.map((member) => [member.uid || member.id, member]));
  return <div className="race-table-wrap"><table className="race-table">
    <thead><tr><th>Rank</th><th>Franchise</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>DIFF</th><th>Streak</th></tr></thead>
    <tbody>{rows.map((row, index) => {
      const current = row.teamUid === currentUid;
      const member = memberMap.get(row.teamUid);
      return <FragmentRow key={row.teamUid} showCutline={index === qualifierCount}>
        <tr className={`${current ? "is-current" : ""} ${row.rank === 1 ? "is-leader" : ""}`}>
          <td data-label="Rank"><strong>#{row.rank}</strong>{row.rank === 1 && <small>LEADER</small>}</td>
          <td data-label="Franchise"><span className="race-team"><i aria-hidden="true">{initials(row.teamName)}</i><span><b title={row.teamName}>{row.teamName}</b><small>{current ? "YOUR TEAM · " : ""}<Link to={`/profile/${row.teamUid}`}>{member?.displayName || "View GM"}</Link></small></span></span></td>
          <td data-label="W">{row.wins}</td><td data-label="L">{row.losses}</td><td data-label="PCT">{formatPct(row.winPercentage)}</td>
          <td className="is-secondary" data-label="GB">{formatGamesBehind(gamesBehind(leader, row), row.rank === 1)}</td>
          <td className={`is-secondary ${row.pointDifferential > 0 ? "is-positive" : row.pointDifferential < 0 ? "is-negative" : ""}`} data-label="DIFF">{row.pointDifferential > 0 ? "+" : ""}{row.pointDifferential}</td>
          <td className="is-secondary" data-label="Streak"><em className={row.streak.startsWith("W") ? "is-winning" : row.streak.startsWith("L") ? "is-losing" : ""}>{row.streak}</em></td>
        </tr>
      </FragmentRow>;
    })}</tbody>
  </table>{finalTable && <p className="race-table-note">Official final seeds are frozen for postseason play.</p>}</div>;
}

function FragmentRow({ children, showCutline }) {
  return <>{showCutline && <tr className="playoff-cutline" aria-label="Playoff cutoff"><td colSpan="8"><span>PLAYOFF LINE</span></td></tr>}{children}</>;
}

export function RaceInsight({ children }) {
  if (!children) return null;
  return <aside className="race-insight"><span>RACE CONTEXT</span><b>{children}</b><Link to="/games">View Games</Link></aside>;
}

export function StandingsSkeleton() {
  return <div className="race-skeleton" aria-label="Loading standings"><div /><div /><div />{Array.from({ length: 5 }, (_, index) => <p key={index}><i /><span /></p>)}</div>;
}
