import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import NotificationDropdown from "./notifications/NotificationDropdown";

function getNavigationGroups(activeLeagueId, status) {
  const leagueItem = {
    to: activeLeagueId ? `/league/${activeLeagueId}` : "/league",
    label: activeLeagueId ? "League Dashboard" : "Create / Join League",
    icon: "◇",
  };

  if (!activeLeagueId || status === LEAGUE_STATUS.LOBBY) {
    return [{ label: "League", icon: "◇", items: [leagueItem] }];
  }
  if (status === LEAGUE_STATUS.DRAFTING) {
    return [
      {
        label: "Franchise",
        icon: "◈",
        items: [{ to: "/league/draft", label: "Draft Center", icon: "⌁" }],
      },
      { label: "League", icon: "◇", items: [leagueItem] },
    ];
  }

  if (status === LEAGUE_STATUS.SEASON_READY) {
    return [
      {
        label: "Franchise",
        icon: "◈",
        items: [{ to: "/my-team", label: "My Team", icon: "◈", team: true }, { to: "/contracts", label: "Contracts", icon: "$" }],
      },
      { label: "League", icon: "◇", items: [leagueItem] },
    ];
  }

  return [
    {
      label: "Franchise",
      icon: "◈",
      items: [
        { to: "/my-team", label: "My Team", icon: "◈", team: true },
        { to: "/contracts", label: "Contracts", icon: "$" },
      ],
    },
    {
      label: "League",
      icon: "◇",
      items: [
        leagueItem,
        ...([LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS].includes(status)
          ? [{ to: "/standings", label: "Standings", icon: "#" }]
          : []),
        ...(status === LEAGUE_STATUS.PLAYOFFS
          ? [{ to: "/playoffs", label: "Playoffs", icon: "P" }]
          : []),
        ...([LEAGUE_STATUS.PLAYOFFS, LEAGUE_STATUS.OFFSEASON].includes(status)
          ? [{ to: "/league/history", label: "Season History", icon: "H" }]
          : []),
      ],
    },
  ];
}

function Header() {
  const { leagueTeam, record } = useLeagueTeam();
  const { activeLeagueId, activeLeague } = useLeague();
  const { user, logout } = useAuth();
  const location = useLocation();
  const headerRef = useRef(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const notifications = [];

  useEffect(() => {
    function closeOutsideMenu(event) {
      if (!headerRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
        setOpenGroup(null);
        setNotificationsOpen(false);
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOutsideMenu);
    return () => document.removeEventListener("mousedown", closeOutsideMenu);
  }, []);

  async function handleLogout() {
    await logout();
  }

  function closeNavigation() {
    setMobileMenuOpen(false);
    setOpenGroup(null);
  }

  const initial = (user?.displayName || user?.email || "U")
    .slice(0, 1)
    .toUpperCase();
  const teamName = leagueTeam?.name || "Franchise setup";
  const userName = user?.displayName || user?.email?.split("@")[0] || "GM";
  const navigableLeagueId =
    activeLeague && activeLeague.status !== LEAGUE_STATUS.CANCELLED
      ? activeLeagueId
      : null;
  const navigationGroups = getNavigationGroups(
    navigableLeagueId,
    activeLeague?.status,
  );
  const gamesAvailable = activeLeague?.status === LEAGUE_STATUS.REGULAR_SEASON;
  const notificationsAvailable = false;

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header__shell">
        <NavLink className="logo" to="/" onClick={closeNavigation}>
          <span className="logo__mark">FC</span>
          <strong>
            <span>FULL COURT</span>
            <small>NBA FANTASY GM</small>
            <em>{teamName}</em>
          </strong>
        </NavLink>
        <button
          className="header-menu-button"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            setMobileMenuOpen((open) => !open);
            setOpenGroup(null);
            setNotificationsOpen(false);
            setProfileMenuOpen(false);
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
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `dashboard-nav__link ${isActive ? "active" : ""}`
            }
            onClick={closeNavigation}
          >
            <span className="dashboard-nav__icon" aria-hidden="true">
              ⌂
            </span>
            <span>Dashboard</span>
          </NavLink>
          {navigationGroups.map((group) => {
            const groupOpen = openGroup === group.label;
            const groupActive = group.items.some(
              (item) => item.to === location.pathname,
            );
            return (
              <div
                className={`dashboard-nav__group ${groupOpen ? "is-open" : ""} ${groupActive ? "has-active" : ""}`}
                key={group.label}
              >
                <button
                  type="button"
                  className="dashboard-nav__group-button"
                  aria-expanded={groupOpen}
                  aria-controls={`nav-${group.label.toLowerCase()}`}
                  onClick={() =>
                    setOpenGroup((current) =>
                      current === group.label ? null : group.label,
                    )
                  }
                >
                  <span className="dashboard-nav__icon" aria-hidden="true">
                    {group.icon}
                  </span>
                  <span>{group.label}</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                <div
                  className="dashboard-nav__flyout"
                  id={`nav-${group.label.toLowerCase()}`}
                >
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `dashboard-nav__flyout-link ${isActive ? "active" : ""} ${item.team ? "dashboard-nav__flyout-link--team" : ""}`
                      }
                      onClick={closeNavigation}
                    >
                      <span className="dashboard-nav__icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.team ? (
                        <span className="dashboard-nav__team">
                          <b>{item.label}</b>
                          <small>
                            {teamName} · {record.wins}-{record.losses}
                          </small>
                        </span>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
          {gamesAvailable && (
            <NavLink
              to="/games"
              className={({ isActive }) =>
                `dashboard-nav__link ${isActive ? "active" : ""}`
              }
              onClick={closeNavigation}
            >
              <span className="dashboard-nav__icon" aria-hidden="true">▶</span>
              <span>Games</span>
            </NavLink>
          )}
        </nav>
        <div className="user-nav">
          {notificationsAvailable && <div className="notification-menu">
            <button
              className="notification-button"
              type="button"
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setProfileMenuOpen(false);
              }}
            >
              <span aria-hidden="true">🔔</span>
              <i
                className="notification-button__indicator"
                aria-label="No unread notifications"
              >
                0
              </i>
            </button>
            {notificationsOpen && (
              <NotificationDropdown
                notifications={notifications}
                onNavigate={() => setNotificationsOpen(false)}
              />
            )}
          </div>}
          <div className="profile-menu">
            <button
              className="header-profile"
              type="button"
              aria-label="Open user menu"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setProfileMenuOpen((open) => !open);
                setNotificationsOpen(false);
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
                <small>GENERAL MANAGER</small>
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
                    <small>GENERAL MANAGER</small>
                  </div>
                </div>
                <div className="profile-dropdown__links">
                  <NavLink
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <span aria-hidden="true">◉</span> Profile
                  </NavLink>
                  <NavLink
                    to="/settings"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <span aria-hidden="true">⚙</span> Settings
                  </NavLink>
                </div>
                <button
                  type="button"
                  className="profile-dropdown__signout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <span aria-hidden="true">↗</span> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
