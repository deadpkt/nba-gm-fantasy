import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import useLeague from '../hooks/useLeague'

function LeaguesPage() {
  const { activeLeague, activeLeagueId, members, createLeague, joinLeague } = useLeague()
  const navigate = useNavigate()
  const [leagueName, setLeagueName] = useState('')
  const [maxMembers, setMaxMembers] = useState(4)
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(event) { event.preventDefault(); setError(''); setBusy(true); try { const id = await createLeague({ name: leagueName, maxMembers: Number(maxMembers) }); navigate(`/league/${id}`) } catch (nextError) { setError(nextError.message) } finally { setBusy(false) } }
  async function join(event) { event.preventDefault(); setError(''); setBusy(true); try { const id = await joinLeague(inviteCode); navigate(`/league/${id}`) } catch (nextError) { setError(nextError.message) } finally { setBusy(false) } }

  return <PageLayout><section className="page-hero league-hero"><p className="section-label">LEAGUE HQ</p><h1>Build a <span>dynasty.</span></h1><p>Create a private league with friends. Drafts, schedules, standings, and playoffs will all live here.</p></section>{activeLeague && <section className="active-league"><div><p className="section-label">ACTIVE LEAGUE</p><h2>{activeLeague.name}</h2><p>{members.length}/{activeLeague.maxMembers} franchises joined / Season {activeLeague.season}</p></div><div className="active-league__links"><Link to="/season">Open season hub</Link><Link to={`/league/${activeLeagueId}`}>Open league</Link></div></section>}<section className="league-draft-entry"><div><p className="section-label">FRANCHISE SETUP</p><h2>Enter the draft room</h2><p>Select your five-player franchise roster before you take the court.</p></div><Link to="/league/draft">Open draft board</Link></section><section className="league-actions"><form onSubmit={create}><p className="section-label">COMMISSIONER MODE</p><h2>Create a private league</h2><label>League name<input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} minLength="3" maxLength="40" required placeholder="Friends NBA League" /></label><label>League size<select value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)}>{[2, 4, 6, 8].map((count) => <option value={count} key={count}>{count} teams</option>)}</select></label><button disabled={busy}>{busy ? 'Creating...' : 'Create league'}</button></form><form onSubmit={join}><p className="section-label">INVITE ONLY</p><h2>Join a league</h2><p>Paste the eight-character invite code from your commissioner.</p><label>Invite code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} minLength="8" maxLength="8" required placeholder="AB12CD34" /></label><button disabled={busy}>{busy ? 'Joining...' : 'Join league'}</button></form></section>{error && <p className="league-error" role="alert">{error}</p>}</PageLayout>
}

export default LeaguesPage
