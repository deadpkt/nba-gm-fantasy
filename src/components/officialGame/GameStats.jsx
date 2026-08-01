const STAT_FIELDS = [["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"], ["steals", "STL"], ["blocks", "BLK"]];

function teamTotals(players, stats, side) {
  return players.filter((player) => player.side === side).reduce((totals, player) => {
    const line = stats[`${side}:${player.playerId}`] || {};
    STAT_FIELDS.forEach(([key]) => { totals[key] += line[key] || 0; });
    return totals;
  }, { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 });
}

export function TeamStatsComparison({ players, stats, game }) {
  const away = teamTotals(players, stats, "away");
  const home = teamTotals(players, stats, "home");
  return <div className="team-comparison"><header><b>{game.awayTeamName}</b><span>TEAM STATS</span><b>{game.homeTeamName}</b></header>{STAT_FIELDS.map(([key, label]) => { const max = Math.max(away[key], home[key], 1); return <div className="comparison-row" key={key}><strong>{away[key]}</strong><i><i style={{ width: `${(away[key] / max) * 50}%` }} /><i style={{ width: `${(home[key] / max) * 50}%` }} /></i><span>{label}</span><strong>{home[key]}</strong></div>; })}</div>;
}

export function PlayerStatsTable({ players, stats }) {
  return <div className="live-player-table"><header><span>PLAYER</span>{STAT_FIELDS.map(([, label]) => <b key={label}>{label}</b>)}</header>{players.map((player) => { const line = stats[`${player.side}:${player.playerId}`] || {}; return <div key={`${player.side}:${player.playerId}`}><span><b>{player.name}</b><small>{player.side.toUpperCase()} · {player.position}</small></span>{STAT_FIELDS.map(([key]) => <strong key={key}>{line[key] || 0}</strong>)}</div>; })}</div>;
}
