function LeagueLeaderCard({ title, player, statistic }) {
  return (
    <article className="leader-card">
      <span>{title}</span>
      {player ? <div className="leader-card__body"><div>{player.image ? <img src={player.image} alt={player.name} /> : <i aria-hidden="true">{player.position}</i>}</div><section><small>{player.team} · {player.position}</small><b>{player.name}</b><strong>{statistic.value} <em>{statistic.label}</em></strong></section><mark>{player.overall}<small>OVR</small></mark></div> : <p>Statistic unavailable in the current player catalog.</p>}
    </article>
  );
}

export default LeagueLeaderCard;
