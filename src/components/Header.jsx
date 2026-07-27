import { NavLink } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";

function Header() {
  const { roster } = useLeagueTeam();
  const { user, logout } = useAuth();
  async function handleLogout() {
    await logout();
  }
  const initial = (user?.displayName || user?.email || "U")
    .slice(0, 1)
    .toUpperCase();
  return (
    <header className="site-header">
      <NavLink className="logo" to="/">
        <span>FC</span>
        <strong>
          FULL COURT<small>FANTASY LEAGUE</small>
        </strong>
      </NavLink>
      <nav aria-label="Main navigation">
        <NavLink end to="/">Home</NavLink>
        <NavLink to="/my-team">
          My team <i>{roster.length}</i>
        </NavLink>
        <NavLink to="/league">League</NavLink>
        <NavLink to="/games">Games</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <div className="user-nav">
        <NavLink
          className="profile-link"
          to="/settings"
          aria-label="Open settings"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
        </NavLink>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Header;
