function formatMatchDate(matchDate) {
  if (!matchDate?.toDate) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(matchDate.toDate());
}

function MatchCard({ title, match }) {
  const isUpcoming = title === "UPCOMING MATCH";
  const opponent = match?.opponent?.name || "Opponent";

  return (
    <article className="season-match-card">
      <span>{title}</span>
      {match ? (
        <>
          <b>{opponent}</b>
          <small>{formatMatchDate(match.matchDate)}</small>
          <strong className={match.won ? "is-win" : "is-loss"}>
            {match.won ? "WIN" : "LOSS"}
          </strong>
        </>
      ) : (
        <>
          <b>{isUpcoming ? "Schedule unavailable" : "No completed matches"}</b>
          <small>
            {isUpcoming
              ? "Match schedule data has not been published."
              : "Your completed matches will appear here."}
          </small>
          <strong>—</strong>
        </>
      )}
    </article>
  );
}
export default MatchCard;
