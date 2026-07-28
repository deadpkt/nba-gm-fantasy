function TradeOffer({ title, players, onRemove, emptyText }) {
  return <section className="trade-offer"><header><span>{title}</span><b>{players.length} PLAYER{players.length === 1 ? "" : "S"}</b></header>{players.length ? <div>{players.map((player) => <article key={player.id} style={{ "--trade-color": player.color || "#e32842" }}><img src={player.image} alt="" /><span><small>{player.position} · {player.team}</small><b>{player.name}</b></span><strong>{player.overall}</strong><button type="button" onClick={() => onRemove(player.id)} aria-label={`Remove ${player.name}`}>×</button></article>)}</div> : <p>{emptyText}</p>}</section>;
}
export default TradeOffer;
