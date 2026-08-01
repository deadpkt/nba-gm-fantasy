import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import UiIcon from "./UiIcon";

function MobileNavigationDrawer({ open, onClose, onLogout, items = [], navigationLoading = false, userName, updatesUnseen = false, admin = false }) {
  const location = useLocation();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button className={`mobile-nav-backdrop ${open ? "is-open" : ""}`} type="button" aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={onClose} />
    <aside id="mobile-navigation" className={`mobile-nav-drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-label="Mobile navigation">
      <header><div><span>GENERAL MANAGER</span><b>{userName}</b></div><button type="button" onClick={onClose} aria-label="Close navigation"><i/><i/></button></header>
      <nav aria-label="Mobile navigation links" aria-busy={navigationLoading}>{items.map(({ to, label, icon }) => <NavLink key={to} to={to} tabIndex={open ? 0 : -1} onClick={onClose} className={({ isActive }) => isActive || (label === "League" && location.pathname === "/league") ? "active" : ""}><UiIcon name={icon}/><span>{label}</span><b aria-hidden="true">›</b></NavLink>)}</nav>
      <div className="mobile-nav-drawer__account">
        <NavLink to="/profile" tabIndex={open ? 0 : -1} onClick={onClose}><UiIcon name="profile"/><span>Profile</span></NavLink>
        <NavLink to="/notifications" tabIndex={open ? 0 : -1} onClick={onClose}><UiIcon name="bell"/><span>Notifications</span></NavLink>
        <NavLink to="/updates" tabIndex={open ? 0 : -1} onClick={onClose}><UiIcon name="info"/><span>What’s New {updatesUnseen && <small className="updates-new-badge">New</small>}</span></NavLink>
        {admin && <NavLink to="/admin/dev-log" tabIndex={open ? 0 : -1} onClick={onClose}><UiIcon name="pen"/><span>Dev Log Admin</span></NavLink>}
        <NavLink to="/settings" tabIndex={open ? 0 : -1} onClick={onClose}><UiIcon name="settings"/><span>Settings</span></NavLink>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => { onClose(); onLogout(); }}><UiIcon name="logout"/><span>Logout</span></button>
      </div>
    </aside>
  </>;
}

export default MobileNavigationDrawer;
