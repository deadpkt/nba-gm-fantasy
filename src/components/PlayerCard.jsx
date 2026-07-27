function PlayerCard({ player, actionLabel = 'Add to team', onAction, disabled = false }) {
  const { name, position, team, overall, stats, image, color } = player
  return <article className="player-card" style={{ '--accent-color': color }}><div className="card-glow" /><div className="player-card__top"><span>{position} · {team}</span><strong>{overall}</strong></div><img className="player-card__image" src={image} alt={name} /><div className="player-card__details"><h2>{name}</h2><div className="player-card__stats"><span><b>{stats.points}</b> PPG</span><span><b>{stats.rebounds}</b> RPG</span><span><b>{stats.assists}</b> APG</span></div>{onAction && <button type="button" onClick={() => onAction(player)} disabled={disabled}>{actionLabel} <span>{actionLabel === 'Remove' ? '×' : '+'}</span></button>}</div></article>
}

export default PlayerCard
