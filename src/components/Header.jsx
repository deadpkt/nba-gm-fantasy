import { NavLink } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import useTeam from '../hooks/useTeam'

function Header() {
  const { team } = useTeam()
  const { user, logout } = useAuth()
  async function handleLogout() { await logout() }
  const initial = (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()
  return <header className="site-header"><NavLink className="logo" to="/"><span>FC</span><strong>FULL COURT<small>FANTASY LEAGUE</small></strong></NavLink><nav aria-label="Main navigation"><NavLink to="/">Players</NavLink><NavLink to="/my-team">My team <i>{team.length}</i></NavLink><NavLink to="/simulation">Simulate</NavLink><NavLink to="/leaderboard">Leaderboard</NavLink></nav><div className="user-nav"><NavLink className="profile-link" to="/profile" aria-label="Open profile">{user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initial}</NavLink><button className="logout-button" onClick={handleLogout}>Logout</button></div></header>
}

export default Header
