import Basketball from "./Basketball";
import CourtPlayer from "./CourtPlayer";
import {
  buildPersistentCourtScene,
  eventFeedback,
} from "../../lib/officialGameCourt";

function BasketballCourt({ game, players, events }) {
  const event = events.at(-1) || null;
  const scene = buildPersistentCourtScene(players, events, game);
  const feedback = eventFeedback(event);
  const ballOwnerId = event?.eventType === "steal"
    ? event.defensivePlayerId
    : event?.reboundPlayerId || event?.playerId;

  return (
    <div className={`official-court is-${event?.eventType || "waiting"}`} aria-label="Live official basketball court">
      <div className="court-boundary" />
      <div className="court-center-line" />
      <div className="court-center-circle"><span>GM</span></div>
      <CourtHalf side="left" />
      <CourtHalf side="right" />
      {players.map((player) => (
        <CourtPlayer
          player={player}
          position={scene.positions.get(`${player.side}:${player.playerId}`)}
          role={scene.roles.get(`${player.side}:${player.playerId}`)}
          hasBall={String(ballOwnerId) === String(player.playerId)}
          key={`${player.side}-${player.playerId}`}
        />
      ))}
      {event?.playerId && <Basketball ball={scene.ball} event={event} />}
      {feedback && <strong className={`court-feedback court-feedback--${event.eventType}`} key={`feedback-${event.sequence}`}>{feedback}</strong>}
      <span className={`court-possession court-possession--${scene.offenseSide}`}>{scene.offenseSide.toUpperCase()} BALL</span>
    </div>
  );
}

function CourtHalf({ side }) {
  return (
    <>
      <div className={`court-key court-key--${side}`} />
      <div className={`court-free-throw court-free-throw--${side}`} />
      <div className={`court-three court-three--${side}`} />
      <div className={`court-backboard court-backboard--${side}`} />
      <div className={`court-rim court-rim--${side}`} />
    </>
  );
}

export default BasketballCourt;
