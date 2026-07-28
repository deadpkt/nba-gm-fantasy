import AchievementCategory from "../components/achievements/AchievementCategory";
import PageLayout from "../components/PageLayout";

const achievementCategories = [
  { title: "Team Building", detail: "Build a franchise with a foundation for success.", achievements: [{ category: "TEAM BUILDING", name: "Rising Star", description: "Establish a franchise ready to compete.", icon: "◇" }] },
  { title: "Winning", detail: "Turn preparation into victories on the court.", achievements: [{ category: "WINNING", name: "First Win", description: "Earn your first recorded franchise win.", icon: "◆" }] },
  { title: "Trading", detail: "Find the deals that reshape your roster.", achievements: [{ category: "TRADING", name: "Trade Expert", description: "Complete a franchise-changing trade.", icon: "⇄" }] },
  { title: "Draft", detail: "Make every selection count on draft night.", achievements: [{ category: "DRAFT", name: "Draft Master", description: "Complete a standout franchise draft.", icon: "⌁" }] },
  { title: "Season", detail: "Chase the standard that defines a dynasty.", achievements: [{ category: "SEASON", name: "Championship Goal", description: "Complete a championship-caliber season.", icon: "♛" }] },
  { title: "Awards", detail: "Earn recognition for elite franchise performance.", achievements: [{ category: "AWARDS", name: "MVP Manager", description: "Lead a player or franchise to season honors.", icon: "★" }] },
  { title: "Management", detail: "Master the decisions behind a lasting contender.", achievements: [{ category: "MANAGEMENT", name: "Elite GM", description: "Reach the highest tier of franchise management.", icon: "◈" }] },
];

function AchievementsPage() {
  return (
    <PageLayout>
      <div className="achievements-page">
        <section className="achievements-hero"><div><p className="section-label">FRANCHISE LEGACY</p><h1>Build your <span>legend.</span></h1><p>Every great franchise has a story. Follow your milestones across team building, winning, trading, drafting, season play, awards, and management.</p></div><div className="achievements-hero__trophy" aria-hidden="true"><span>★</span><b>LEGACY</b><small>ACHIEVEMENTS</small></div></section>
        <section className="achievements-intro"><div><span>YOUR TROPHY CASE</span><b>Progress tracking is not available yet.</b></div><p>Achievement goals are ready to display. Unlock status and progress will appear here once achievement tracking is available.</p></section>
        <div className="achievements-categories">{achievementCategories.map((category) => <AchievementCategory key={category.title} {...category} />)}</div>
      </div>
    </PageLayout>
  );
}

export default AchievementsPage;
