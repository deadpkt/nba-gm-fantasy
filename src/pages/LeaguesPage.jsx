import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useLeague from "../hooks/useLeague";
import { getLeagueStatusLabel, LEAGUE_STATUS } from "../lib/leagueStatuses";
import { createRosterConfig, getLeagueSalaryCap } from "../lib/rosterConfig";
import {
  DEFAULT_SEASON_PRESET,
  getSeasonPresetOptions,
  SUPPORTED_LEAGUE_SIZES,
} from "../lib/seasonConfig";
import { getUserFriendlyError } from "../lib/clientErrors";
import "../leagueEntry.css";

const LEAGUE_SIZE_LABELS = Object.freeze({ 2: "Head-to-head", 4: "Classic", 6: "Expanded", 8: "Full league" });
const formatMillions = (value) => `$${value / 1_000_000}M`;

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
  const rosterConfig = createRosterConfig();
  const salaryCap = getLeagueSalaryCap({ rosterConfig });
  const selectedSeason = getSeasonPresetOptions(maxMembers).find((option) => option.preset === seasonPreset);

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
      setError(getUserFriendlyError(nextError, "Could not create the league."));
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
      setError(getUserFriendlyError(nextError, "Could not join that league."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout>
      {activeLeague && <header className="league-page-header has-league">
        <div>
          <p className="section-label">YOUR LEAGUE</p>
          <h1>{activeLeague.name}</h1>
          <p>Season {activeLeague.season} · {getLeagueStatusLabel(activeLeague.status)} · {members.length}/{activeLeague.maxMembers} franchises</p>
        </div>
        <Link to={`/league/${activeLeagueId}`}>Open League</Link>
      </header>}
      {accessMessage && <p className="league-access-message" role="status">{accessMessage}</p>}
      {activeLeague?.status === LEAGUE_STATUS.DRAFTING && (
        <section className="league-draft-entry">
          <div>
            <p className="section-label">DRAFT PHASE</p>
            <h2>Enter the draft room</h2>
            <p>The league is drafting. Continue building your franchise in the shared draft room.</p>
          </div>
          <Link to="/league/draft">Open draft room</Link>
        </section>
      )}
      <section className="league-actions league-entry" aria-label="Create or join a league">
        <header className="league-entry__header"><p className="section-label">START YOUR LEAGUE</p><h2>Create a new league or join an existing one.</h2></header>
        <form className="league-create" onSubmit={create}>
          <header className="league-create__header">
            <p className="section-label">CREATE YOUR LEAGUE</p>
            <h2>Build your league.</h2>
            <p>Invite your friends. Start your dynasty.</p>
          </header>
          <div className="league-create__layout">
            <div className="league-create__setup">
              <label className="league-field league-field--name" htmlFor="league-name"><span>League Name <small>{leagueName.length}/40</small></span><input id="league-name" value={leagueName} onChange={(event) => setLeagueName(event.target.value)} minLength="3" maxLength="40" required placeholder="Full Court Dynasty" /></label>
              <fieldset className="league-size-picker"><legend>League Size</legend><div>{SUPPORTED_LEAGUE_SIZES.map((count) => <label className={maxMembers === count ? "is-selected" : ""} key={count}><input type="radio" name="league-size" value={count} checked={maxMembers === count} onChange={() => setMaxMembers(count)} /><strong>{count}</strong><span>{count} Teams</span><small>{LEAGUE_SIZE_LABELS[count]}</small><i aria-hidden="true">✓</i></label>)}</div></fieldset>
          <label>Season length<select value={seasonPreset} onChange={(event) => setSeasonPreset(event.target.value)}>{getSeasonPresetOptions(maxMembers).map((option) => <option value={option.preset} key={option.preset}>{option.label} — {option.gamesPerTeam} games/team</option>)}</select></label>
            </div>
            <aside className="league-format-preview" aria-live="polite"><span>League Format</span><strong>{maxMembers} Teams</strong><dl><div><dt>Roster</dt><dd>{rosterConfig.rosterSize} players</dd></div><div><dt>Starting Five</dt><dd>{rosterConfig.starterCount}</dd></div><div><dt>Bench</dt><dd>{rosterConfig.benchSize}</dd></div><div><dt>Salary Cap</dt><dd>{formatMillions(salaryCap)}</dd></div><div><dt>Season</dt><dd>{selectedSeason?.gamesPerTeam} games/team</dd></div><div><dt>Draft</dt><dd>Snake Draft</dd></div></dl></aside>
          </div>
          <footer className="league-create__footer"><div><strong>{leagueName.trim() || "Your League"}</strong><span>{maxMembers}-team league · {rosterConfig.rosterSize}-player rosters · Snake Draft</span></div><button disabled={busy}>{busy ? "Creating League..." : "Create League"}</button></footer>
        </form>
        <form className="league-join-card" onSubmit={join}>
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
