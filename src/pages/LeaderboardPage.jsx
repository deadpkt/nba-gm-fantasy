import PageLayout from '../components/PageLayout'
import useTeam from '../hooks/useTeam'

function LeaderboardPage() {
  const { record } = useTeam()
  const rows = [['Batu’s Ballers', record.wins, record.losses, record.wins * 116 + record.losses * 102, true], ['Court Kings', 7, 2, 1021], ['Tbilisi Titans', 6, 3, 987], ['Fast Breakers', 5, 4, 934], ['Fourth Quarter', 3, 6, 864]]
  return <PageLayout><section className="page-hero"><p className="section-label">SUNDAY BALLERS</p><h1>League <span>leaderboard.</span></h1><p>Every simulated match contributes to your season record.</p></section><section className="leaderboard"><div className="leaderboard-head"><span>RANK / TEAM</span><span>W</span><span>L</span><span>PTS</span></div>{rows.sort((a, b) => b[1] - a[1]).map((row, index) => <div className={`leaderboard-row ${row[4] ? 'current-user' : ''}`} key={row[0]}><strong>0{index + 1}</strong><b>{row[0]} {row[4] && <i>YOU</i>}</b><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span></div>)}</section></PageLayout>
}

export default LeaderboardPage
