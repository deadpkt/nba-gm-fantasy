import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { getChemistry, getLineupOverall } from "../utils/team";

function ProfilePage() {
  const { user } = useAuth();
  const { roster, lineup, record } = useLeagueTeam();
  const initial = (user.displayName || user.email).slice(0, 1).toUpperCase();
  return (
    <PageLayout>
      <section className="page-hero">
        <p className="section-label">SETTINGS</p>
        <h1>
          {user.displayName || "Full Court"}
          <span> profile.</span>
        </h1>
        <p>{user.email}</p>
      </section>
      <section className="profile-grid">
        <div className="profile-card">
          <span className="profile-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              initial
            )}
          </span>
          <div>
            <small>LEAGUE MEMBER</small>
            <h2>{user.displayName || "Full Court Player"}</h2>
            <p>{user.email}</p>
          </div>
        </div>
        <div className="profile-metric">
          <span>LINEUP OVR</span>
          <b>{getLineupOverall(roster, lineup) || "-"}</b>
        </div>
        <div className="profile-metric">
          <span>CHEMISTRY</span>
          <b>
            {getChemistry(roster) || "-"}
            <i>%</i>
          </b>
        </div>
        <div className="profile-metric">
          <span>RECORD</span>
          <b>
            {record.wins}
            <i>-{record.losses}</i>
          </b>
        </div>
      </section>
      <section className="players-section">
        <div className="section-heading">
          <div>
            <p className="section-label">SAVED ROSTER</p>
            <h2>
              Your team <span>{roster.length}/5 players</span>
            </h2>
          </div>
        </div>
        {roster.length ? (
          <div className="profile-roster">
            {roster.map((player) => (
              <div key={player.id}>
                <img src={player.image} alt="" />
                <span>{player.position}</span>
                <strong>{player.name}</strong>
                <b>{player.overall}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No saved players yet.</h2>
            <p>Go to the player market to build your first team.</p>
          </div>
        )}
      </section>
    </PageLayout>
  );
}

export default ProfilePage;
