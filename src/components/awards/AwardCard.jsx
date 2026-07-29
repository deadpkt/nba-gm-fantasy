function AwardCard({
  title,
  abbreviation,
  player,
  statistic,
  unavailableReason,
}) {
  return (
    <article
      className={`award-card ${player ? "" : "award-card--unavailable"}`}
    >
      <div className="award-card__top">
        <span>{abbreviation}</span>
        <small>{title}</small>
      </div>
      {player ? (
        <div className="award-card__player">
          {player.image ? (
            <img src={player.image} alt={player.name} />
          ) : (
            <div className="award-card__headshot" aria-hidden="true">
              {player.position}
            </div>
          )}
          <div>
            <b>{player.name}</b>
            <span>
              {player.team} · {player.position} · {player.overall} OVR
            </span>
            <strong>
              {statistic.value} <small>{statistic.label}</small>
            </strong>
          </div>
        </div>
      ) : (
        <div className="award-card__empty">
          <b>Award data unavailable</b>
          <p>{unavailableReason}</p>
        </div>
      )}
    </article>
  );
}

export default AwardCard;
