import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DevLogEntry from "../components/devLog/DevLogEntry";
import FullCourtLogo from "../components/brand/FullCourtLogo";
import { loadPublishedDevLogs, markVersionSeen } from "../lib/devLogs";
import "../updates.css";
export default function UpdatesPage() {
  const [state, setState] = useState({ logs: [], loading: true, error: false });
  useEffect(() => { let active = true; loadPublishedDevLogs().then((logs) => { if (!active) return; setState({ logs, loading: false, error: false }); markVersionSeen(logs[0]?.version); }).catch(() => { if (active) setState({ logs: [], loading: false, error: true }); }); return () => { active = false; }; }, []);
  return <main className="updates-page"><nav><Link to="/" aria-label="FULL COURT home"><FullCourtLogo size={30} /><b>FULL COURT</b></Link><Link to="/">Back to Home</Link></nav><div className="updates-shell"><header className="updates-header"><span>FULL COURT DEV LOG</span><h1>What’s New</h1><p>See what’s new, improved, and fixed in FULL COURT.</p></header>{state.loading ? <div className="updates-skeleton"><i/><i/><i/></div> : state.error ? <p className="updates-empty">Updates are temporarily unavailable.</p> : state.logs.length === 0 ? <p className="updates-empty">No updates published yet.</p> : <section className="updates-timeline" aria-label="Published updates">{state.logs.map((log, index) => <DevLogEntry log={log} latest={index === 0} key={log.id} />)}</section>}</div></main>;
}
