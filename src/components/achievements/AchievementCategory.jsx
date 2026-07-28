import AchievementCard from "./AchievementCard";

function AchievementCategory({ title, detail, achievements }) {
  return (
    <section className="achievement-category">
      <header><div><span>ACHIEVEMENT CATEGORY</span><h2>{title}</h2></div><p>{detail}</p></header>
      <div className="achievement-category__grid">{achievements.map((achievement) => <AchievementCard key={achievement.name} achievement={achievement} />)}</div>
    </section>
  );
}

export default AchievementCategory;
