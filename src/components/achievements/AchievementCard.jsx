import ProgressBadge from "./ProgressBadge";

function AchievementCard({ achievement }) {
  return (
    <article
      className={`achievement-card ${achievement.unlocked ? "is-unlocked" : "is-locked"}`}
    >
      <div className="achievement-card__medal">
        <span aria-hidden="true">{achievement.icon}</span>
        <i aria-hidden="true">{achievement.unlocked ? "✓" : "LOCKED"}</i>
      </div>
      <div className="achievement-card__content">
        <header>
          <span>{achievement.category}</span>
          <ProgressBadge
            unlocked={achievement.unlocked}
            progressAvailable={achievement.progressAvailable}
          />
        </header>
        <h3>{achievement.name}</h3>
        <p>{achievement.description}</p>
        <footer>
          <small>REWARD</small>
          <b>{achievement.reward || "Reward details coming soon"}</b>
        </footer>
      </div>
    </article>
  );
}

export default AchievementCard;
