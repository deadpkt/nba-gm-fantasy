import { useState } from 'react'
import PageLayout from '../components/PageLayout'
import PlayerCard from '../components/PlayerCard'
import players from '../data/players'
import useTeam from '../hooks/useTeam'

function HomePage() {
  const [position, setPosition] = useState('ALL')
  const { team, addPlayer } = useTeam()
  const filteredPlayers = position === 'ALL' ? players : players.filter((player) => player.position === position)
  return <PageLayout><section className="hero-section"><p className="section-label">BUILD YOUR DYNASTY</p><h1>Pick your <span>starting five.</span></h1><p className="hero-copy">Draft elite NBA talent, build chemistry, and take your friends to the final buzzer.</p><div className="hero-score"><span>WEEK 01</span><b>PLAYER MARKET OPEN</b><span>{5 - team.length} ROSTER SPOTS</span></div></section><section className="players-section"><div className="section-heading"><div><p className="section-label">PLAYER MARKET</p><h2>Available superstars <span>{filteredPlayers.length} players</span></h2></div><select className="filter-button" value={position} onChange={(event) => setPosition(event.target.value)}><option value="ALL">All positions</option>{['PG', 'SG', 'SF', 'PF', 'C'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="players-grid">{filteredPlayers.map((player) => <PlayerCard key={player.id} player={player} onAction={addPlayer} disabled={team.some((member) => member.id === player.id) || team.length === 5} actionLabel={team.some((member) => member.id === player.id) ? 'On your team' : 'Add to team'} />)}</div></section></PageLayout>
}

export default HomePage
