import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { getHeaderNavigation, getPrimaryNavigationItems } from "../lib/headerNavigation";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import FullCourtLogo from "./brand/FullCourtLogo";
import MobileNavigationDrawer from "./MobileNavigationDrawer";
import NotificationBell from "../features/notifications/components/NotificationBell";
import useAdminClaim from "../hooks/useAdminClaim";
import useLatestUpdate from "../hooks/useLatestUpdate";
import "./brand/brand.css";
import "./navigation.css";

function Header() {
  const { activeLeagueId, activeLeague, leagueLoading } = useLeague();
  const { user, logout } = useAuth();
  const headerRef = useRef(null);
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const { admin } = useAdminClaim();
  const latestUpdate = useLatestUpdate();

  useEffect(() => {
    function closeOutside(event) {
      if (!headerRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        setLeagueMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const closeNavigation = () => {
    setMobileMenuOpen(false);
    setLeagueMenuOpen(false);
  };
  const userName = user?.displayName || user?.email?.split("@")[0] || "GM";
  const initial = userName.slice(0, 1).toUpperCase();
  const items = getHeaderNavigation(activeLeagueId, activeLeague?.status);
  const mobileItems = getPrimaryNavigationItems({ activeLeagueId, status: activeLeague?.status, loading: leagueLoading });
  const hasActiveLeague = Boolean(
    activeLeagueId && activeLeague?.status !== LEAGUE_STATUS.CANCELLED,
  );
  const historyAvailable = [
    LEAGUE_STATUS.SEASON_READY,
    LEAGUE_STATUS.REGULAR_SEASON,
    LEAGUE_STATUS.PLAYOFFS,
    LEAGUE_STATUS.OFFSEASON,
  ].includes(activeLeague?.status);
  const leagueContextActive =
    location.pathname === "/league" ||
    (/^\/league\//.test(location.pathname) &&
      location.pathname !== "/league/draft");

  return (
    <header
      className="site-header"
      ref={headerRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setLeagueMenuOpen(false);
          setProfileMenuOpen(false);
          setMobileMenuOpen(false);
        }
      }}
    >
      <div className="site-header__shell">
        <NavLink
          className="logo"
          to="/"
          onClick={closeNavigation}
          aria-label="FULL COURT — Home"
        >
          <span className="brand-lockup">
            <FullCourtLogo size={32} />
            <strong className="brand-lockup__name">FULL COURT</strong>
          </span>
        </NavLink>

        <button
          className="header-menu-button"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => {
            setMobileMenuOpen((open) => !open);
            setProfileMenuOpen(false);
            setLeagueMenuOpen(false);
          }}
        >
          <i />
          <i />
          <i />
        </button>

        <nav
          className={`dashboard-nav ${mobileMenuOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {hasActiveLeague ? (
            <div
              className={`dashboard-nav__group ${leagueMenuOpen ? "is-open" : ""} ${leagueContextActive ? "has-active" : ""}`}
            >
              <button
                className="dashboard-nav__group-button"
                type="button"
                aria-expanded={leagueMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setLeagueMenuOpen((open) => !open);
                  setProfileMenuOpen(false);
                }}
              >
                <span>League</span>
                <i aria-hidden="true">⌄</i>
              </button>
              <div className="dashboard-nav__flyout" role="menu">
                <NavLink
                  className="dashboard-nav__flyout-link"
                  to={`/league/${activeLeagueId}`}
                  role="menuitem"
                  onClick={closeNavigation}
                >
                  League Home
                </NavLink>
                {historyAvailable && (
                  <NavLink
                    className="dashboard-nav__flyout-link"
                    to="/league/history"
                    role="menuitem"
                    onClick={closeNavigation}
                  >
                    Season History
                  </NavLink>
                )}
              </div>
            </div>
          ) : (
            <NavLink
              to="/league"
              className={({ isActive }) =>
                `dashboard-nav__link ${isActive ? "active" : ""}`
              }
              onClick={closeNavigation}
            >
              <span>League</span>
            </NavLink>
          )}
          {items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              className={({ isActive }) =>
                `dashboard-nav__link ${isActive ? "active" : ""}`
              }
              onClick={closeNavigation}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="user-nav">
          <NotificationBell onOpen={() => {
            setProfileMenuOpen(false);
            setMobileMenuOpen(false);
            setLeagueMenuOpen(false);
          }} />
          <div className="profile-menu">
            <button
              className="header-profile"
              type="button"
              aria-label="Open account menu"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setProfileMenuOpen((open) => !open);
                setMobileMenuOpen(false);
                setLeagueMenuOpen(false);
              }}
            >
              <span className="profile-link">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initial
                )}
              </span>
              <span className="header-profile__copy">
                <small>General Manager</small>
                <b>{userName}</b>
              </span>
              <i aria-hidden="true">⌄</i>
            </button>
            {profileMenuOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-dropdown__identity">
                  <span className="profile-link">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initial
                    )}
                  </span>
                  <div>
                    <b>{userName}</b>
                    <small>General Manager</small>
                  </div>
                </div>
                <div className="profile-dropdown__links">
                  <NavLink
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Profile
                  </NavLink>
                  <NavLink
                    to="/updates"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    What’s New {latestUpdate.unseen && <small className="updates-new-badge">New</small>}
                  </NavLink>
                  {admin && <NavLink to="/admin/dev-log" role="menuitem" onClick={() => setProfileMenuOpen(false)}>Dev Log Admin</NavLink>}
                  {admin && <NavLink to="/admin/nba-data/ratings-preview" role="menuitem" onClick={() => setProfileMenuOpen(false)}>Ratings Preview</NavLink>}
                  <NavLink
                    to="/settings"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Settings
                  </NavLink>
                </div>
                <button
                  type="button"
                  className="profile-dropdown__signout"
                  role="menuitem"
                  onClick={logout}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileNavigationDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onLogout={logout} items={mobileItems} navigationLoading={leagueLoading} userName={userName} updatesUnseen={latestUpdate.unseen} admin={admin} />
    </header>
  );
}

export default Header;
