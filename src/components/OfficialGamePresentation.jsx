import { useEffect, useMemo, useState } from "react";
import "../officialGame.css";
import BasketballCourt from "./officialGame/BasketballCourt";
import LiveScoreboard from "./officialGame/LiveScoreboard";
import {
  getPresentationFrame,
  getProgressivePlayerStats,
} from "../lib/officialGamePresentation";

const ZERO = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };

function OfficialGamePresentation({ game, renderFinal }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);
  const frame = getPresentationFrame(game, now);
  const stats = useMemo(
    () => getProgressivePlayerStats(frame.visibleEvents),
    [frame.visibleEvents],
  );
  const event = frame.currentEvent;
  const players = useMemo(
    () => [
      ...(game.boxScore?.away?.players || []).map((player) => ({ ...player, side: "away" })),
      ...(game.boxScore?.home?.players || []).map((player) => ({ ...player, side: "home" })),
    ],
    [game.boxScore?.away?.players, game.boxScore?.home?.players],
  );

  if (!game.timeline?.length) {
    return game.status === "completed" ? renderFinal() : <p>Generating the authoritative game timeline...</p>;
  }
  return (
    <div className="official-live">
      <LiveScoreboard game={game} event={event} />
      <BasketballCourt
        game={game}
        players={players}
        events={frame.visibleEvents.filter((item) => item.offenseUid)}
      />
      <div className="official-live__lower">
        <section className="official-live__feed">
          <h4>LIVE EVENTS</h4>
          {[...frame.visibleEvents].reverse().slice(0, 10).map((item, index) => (
            <p className={index === 0 ? "is-current" : ""} key={item.sequence}>
              <time>{item.gameClock}</time><b>{item.text}</b>
            </p>
          ))}
        </section>
        <section className="official-live__stats">
          <h4>LIVE PLAYER STATS</h4>
          {players.map((player) => {
            const line = stats[`${player.side}:${player.playerId}`] || ZERO;
            return (
              <p key={`${player.side}-stats-${player.playerId}`}>
                <b>{player.name}</b>
                <span>{line.points} PTS · {line.rebounds} REB · {line.assists} AST · {line.steals} STL · {line.blocks} BLK</span>
              </p>
            );
          })}
        </section>
      </div>
      {frame.finished && renderFinal()}
    </div>
  );
}

export default OfficialGamePresentation;
