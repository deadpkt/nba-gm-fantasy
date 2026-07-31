import { Link, useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";

function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function signOut() { await logout(); navigate("/login", { replace: true }); }
  return <PageLayout><div className="account-settings-page">
    <section className="page-hero"><p className="section-label">ACCOUNT</p><h1>Settings<span>.</span></h1><p>Account access and application preferences.</p></section>
    <section className="settings-card settings-account-card">
      <div className="settings-card__heading"><div><p className="section-label">ACCOUNT DETAILS</p><h2>Signed-in account</h2></div></div>
      <dl><div><dt>Email</dt><dd>{user.email || "Unavailable"}</dd></div><div><dt>Public identity</dt><dd>{user.displayName || "Full Court Player"}</dd></div></dl>
      <footer><Link className="button-secondary" to="/profile">Open Profile</Link><button className="button-primary" type="button" onClick={signOut}>Sign Out</button></footer>
    </section>
    <section className="settings-card settings-preferences-card"><p className="section-label">APP PREFERENCES</p><h2>Preferences</h2><p>Additional application preferences will appear here when supported.</p></section>
  </div></PageLayout>;
}
export default SettingsPage;
