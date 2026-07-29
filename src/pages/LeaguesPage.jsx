import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useLeague from "../hooks/useLeague";
import { LEAGUE_STATUS } from "../lib/leagueStatuses";
import {
  DEFAULT_SEASON_PRESET,
  getSeasonPresetOptions,
  SUPPORTED_LEAGUE_SIZES,
} from "../lib/seasonConfig";

function LeaguesPage() {
  const { activeLeague, activeLeagueId, members, createLeague, joinLeague } =
    useLeague();
  const navigate = useNavigate();
  const location = useLocation();
  const [leagueName, setLeagueName] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [seasonPreset, setSeasonPreset] = useState(DEFAULT_SEASON_PRESET);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accessMessage = location.state?.leagueAccessMessage;

  async function create(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const id = await createLeague({
        name: leagueName,
        maxMembers: Number(maxMembers),
        seasonPreset,
      });
      navigate(`/league/${id}`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function join(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const id = await joinLeague(inviteCode);
      navigate(`/league/${id}`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout>
      <section className="page-hero league-hero">
        <p className="section-label">LEAGUE HQ</p>
        <h1>Build a <span>dynasty.</span></h1>
        <p>Create a private league with friends. Drafts, schedules, standings, and playoffs will all live here.</p>
      </section>
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
      {activeLeague && (
        <section className="active-league">
          <div>
            <p className="section-label">ACTIVE LEAGUE</p>
            <h2>{activeLeague.name}</h2>
            <p>{members.length}/{activeLeague.maxMembers} franchises joined / Season {activeLeague.season}</p>
          </div>
          <div className="active-league__links">
            <Link to={`/league/${activeLeagueId}`}>Open league</Link>
          </div>
        </section>
      )}
      {activeLeague?.status === LEAGUE_STATUS.DRAFTING && (
        <section className="league-draft-entry">
          <div>
            <p className="section-label">DRAFT PHASE</p>
            <h2>Enter the draft room</h2>
            <p>The league is in the drafting phase. Shared draft logic will be implemented separately.</p>
          </div>
          <Link to="/league/draft">Open draft room</Link>
        </section>
      )}
      <section className="league-actions">
        <form onSubmit={create}>
          <p className="section-label">COMMISSIONER MODE</p>
          <h2>Create a private league</h2>
          <label>League name<input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} minLength="3" maxLength="40" required placeholder="Friends NBA League" /></label>
          <label>League size<select value={maxMembers} onChange={(event) => setMaxMembers(Number(event.target.value))}>{SUPPORTED_LEAGUE_SIZES.map((count) => <option value={count} key={count}>{count} teams</option>)}</select></label>
          <label>Season length<select value={seasonPreset} onChange={(event) => setSeasonPreset(event.target.value)}>{getSeasonPresetOptions(maxMembers).map((option) => <option value={option.preset} key={option.preset}>{option.label} — {option.gamesPerTeam} games/team</option>)}</select></label>
          <button disabled={busy}>{busy ? "Creating..." : "Create league"}</button>
        </form>
        <form onSubmit={join}>
          <p className="section-label">INVITE ONLY</p>
          <h2>Join a league</h2>
          <p>Paste the eight-character invite code from your commissioner.</p>
          <label>Invite code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} minLength="8" maxLength="8" required placeholder="AB12CD34" /></label>
          <button disabled={busy}>{busy ? "Joining..." : "Join league"}</button>
        </form>
      </section>
      {error && <p className="league-error" role="alert">{error}</p>}
    </PageLayout>
  );
}

export default LeaguesPage;
