import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import PlayerCard from '../components/PlayerCard'
import useTeam from '../hooks/useTeam'
import { getChemistry, getTeamOverall } from '../utils/team'

function MyTeamPage() {
  const { team, removePlayer, record } = useTeam()
  const overall = getTeamOverall(team)
  const chemistry = getChemistry(team)
  return <PageLayout><section className="page-hero"><p className="section-label">MY FRANCHISE</p><h1>Your <span>starting five.</span></h1><p>Build a balanced roster, then test it in a simulated matchup.</p></section><section className="team-dashboard"><div className="team-score"><span>TEAM OVR</span><b>{overall || '—'}</b><small>Average player rating</small></div><div className="team-score"><span>CHEMISTRY</span><b>{chemistry || '—'}<i>%</i></b><small>Position & team balance</small></div><div className="team-score"><span>SEASON RECORD</span><b>{record.wins}<i>–{record.losses}</i></b><small>Simulated matches</small></div><Link className={`simulate-link ${team.length < 5 ? 'disabled' : ''}`} to={team.length === 5 ? '/simulation' : '/my-team'}>Simulate game <span>→</span></Link></section><section className="players-section"><div className="section-heading"><div><p className="section-label">YOUR ROSTER</p><h2>Selected players <span>{team.length}/5 players</span></h2></div></div>{team.length ? <div className="players-grid">{team.map((player) => <PlayerCard key={player.id} player={player} actionLabel="Remove" onAction={() => removePlayer(player.id)} />)}</div> : <div className="empty-state"><h2>Your roster is empty.</h2><p>Choose five players from the market to unlock game simulation.</p><Link to="/">Browse players →</Link></div>}</section></PageLayout>
}

export default MyTeamPage
