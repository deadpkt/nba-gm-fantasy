import { Link } from "react-router-dom";
import { formatActivityTime, leagueActivityPresentation } from "../../lib/leagueActivity";
import { getLeagueStatusLabel } from "../../lib/leagueStatuses";

function FranchiseFeature({ league, team, ownProfile }) {
  if (!league || !team) return null;
  const wins = Number(team?.record?.wins ?? team?.wins ?? 0);
  const losses = Number(team?.record?.losses ?? team?.losses ?? 0);
  const teamName = team.name || team.teamName || "My Franchise";
  return <aside className="profile-franchise-feature">
    <span>Current franchise</span>
    <div className="profile-franchise-feature__heading"><i aria-hidden="true">{teamName.slice(0, 2).toUpperCase()}</i><h2>{teamName}</h2></div>
    <p>{league.name}</p>
    <p className="profile-franchise-feature__meta">Season {league.season || 1} · {getLeagueStatusLabel(league.status)} · {wins}-{losses}</p>
    {ownProfile && <Link to="/my-team">View Team <span aria-hidden="true">→</span></Link>}
  </aside>;
}

function ActivityFeature({ activities }) {
  if (!activities.length) return null;
  return <section className="profile-activity-feature"><header><span>Recent public activity</span><h2>Latest from the league</h2></header><ol>{activities.slice(0, 5).map((activity) => {
    const presentation = leagueActivityPresentation(activity);
    return <li key={activity.id}><i aria-hidden="true" /><div><strong>{presentation.text}</strong><time>{formatActivityTime(activity)}</time></div></li>;
  })}</ol></section>;
}

export default function ProfileEditorial({ league, team, ownProfile = false, activities = [] }) {
  if (!league || !team) return null;
  return <div className="profile-editorial-stream"><div className="profile-editorial-stream__intro"><FranchiseFeature league={league} team={team} ownProfile={ownProfile} /></div><ActivityFeature activities={activities} /></div>;
}
