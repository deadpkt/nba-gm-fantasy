import { Link } from "react-router-dom";
import { formatActivityTime, leagueActivityPresentation, leagueActivityRoute } from "../../lib/leagueActivity";

const icons = { league: "L", member: "+", draft: "D", round: "R", game: "●", roster: "↕", playoffs: "P", champion: "★" };

function LeagueActivityItem({ activity }) {
  const presentation = leagueActivityPresentation(activity);
  const route = leagueActivityRoute(activity);
  return <article className={`league-activity-item league-activity-item--${presentation.icon}`}>
    <span className="league-activity-item__icon" aria-hidden="true">{icons[presentation.icon]}</span>
    <div><p>{presentation.text}</p><small>{formatActivityTime(activity)}</small></div>
    {route && <Link to={route}>{activity.type === "champion_crowned" ? "Season history" : "Open games"}</Link>}
  </article>;
}

export default LeagueActivityItem;
