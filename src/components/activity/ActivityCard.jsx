const activityIcons = {
  member_joined: "◇",
  draft_pick: "⌁",
  trade_completed: "⇄",
  match_result: "◆",
  award_received: "★",
  team_update: "◈",
};

const activityLabels = {
  member_joined: "LEAGUE",
  draft_pick: "DRAFT",
  trade_completed: "TRADE",
  match_result: "RESULT",
  award_received: "AWARD",
  team_update: "TEAM",
};

function ActivityCard({ activity }) {
  const type = activity.type || "team_update";
  return (
    <article className={`activity-card activity-card--${type}`}>
      <div className="activity-card__marker" aria-hidden="true"><span>{activityIcons[type]}</span></div>
      <div className="activity-card__content"><header><span>{activityLabels[type]}</span><small>{activity.timestamp}</small></header><h3>{activity.title}</h3><p>{activity.description}</p><b>{activity.subject}</b></div>
    </article>
  );
}

export default ActivityCard;
