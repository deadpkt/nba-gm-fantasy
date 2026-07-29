import ActivityCard from "./ActivityCard";

function ActivityTimeline({ activities = [] }) {
  if (!activities.length) {
    return (
      <section className="activity-empty">
        <div aria-hidden="true">
          <i>◌</i>
        </div>
        <b>No league activity yet.</b>
        <p>
          Member updates, draft picks, completed trades, results, awards, and
          team changes will appear in this timeline.
        </p>
      </section>
    );
  }

  return (
    <div className="activity-timeline">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

export default ActivityTimeline;
