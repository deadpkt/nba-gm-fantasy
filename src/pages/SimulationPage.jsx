import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import players from '../data/players'
import useTeam from '../hooks/useTeam'
import { simulateGame } from '../utils/simulateGame'
import { getTeamOverall } from '../utils/team'

const opponent = players.slice(6, 11)

function SimulationPage() {
  const { team, saveResult } = useTeam()
  const [result, setResult] = useState(null)
  const canPlay = team.length === 5
  function playGame() { const game = simulateGame(team, opponent); setResult(game); saveResult(game.homeWon) }
  if (!canPlay) return <PageLayout><section className="empty-state simulation-empty"><h2>Build a full five-player team first.</h2><p>Game simulation unlocks when your roster has five players.</p><Link to="/">Go to player market →</Link></section></PageLayout>
  return <PageLayout><section className="page-hero simulation-hero"><p className="section-label">EXHIBITION MATCHUP</p><h1>Ready for <span>tip-off?</span></h1><p>Your squad faces an elite Full Court AI roster.</p></section><section className="matchup-panel"><div className="match-team"><span className="match-logo home-logo">FC</span><p>YOUR TEAM</p><b>{getTeamOverall(team)}</b><small>TEAM OVR</small></div><div className="match-center"><span>VS</span><button onClick={playGame}>Simulate match</button><small>OVR + RANDOM PERFORMANCE</small></div><div className="match-team"><span className="match-logo away-logo">AI</span><p>COURT KINGS</p><b>{getTeamOverall(opponent)}</b><small>TEAM OVR</small></div></section>{result && <section className="result-panel"><p className="section-label">FINAL SCORE</p><div className="final-score"><div><span>Your Team</span><b className={result.homeWon ? 'winner' : ''}>{result.home.score}</b></div><em>—</em><div><span>Court Kings</span><b className={!result.homeWon ? 'winner' : ''}>{result.away.score}</b></div></div><div className="mvp"><img src={result.mvp.image} alt={result.mvp.name} /><div><span>GAME MVP</span><strong>{result.mvp.name}</strong><small>{result.mvp.overall} OVR · {result.mvp.position}</small></div></div><div className="team-stats"><Stat title="FG%" home={result.home.fieldGoal} away={result.away.fieldGoal} /><Stat title="REB" home={result.home.rebounds} away={result.away.rebounds} /><Stat title="AST" home={result.home.assists} away={result.away.assists} /><Stat title="TO" home={result.home.turnovers} away={result.away.turnovers} /></div></section>}</PageLayout>
}
function Stat({ title, home, away }) { return <div><span>{title}</span><b>{home}</b><i>{away}</i></div> }
export default SimulationPage
