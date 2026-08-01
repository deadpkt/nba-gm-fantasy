import { useEffect, useMemo, useRef, useState } from "react";
import "../officialGame.css";
import LiveScoreboard from "./officialGame/LiveScoreboard";
import {
  BreakState,
  CurrentPossession,
  GameLeaders,
  LastPlay,
  MomentumPanel,
  PlayByPlayFeed,
} from "./officialGame/GamecastPanels";
import { PlayerStatsTable, TeamStatsComparison } from "./officialGame/GameStats";
import {
  getAuthoritativePresentationFrame,
  getPresentationFrame,
  getProgressivePlayerStats,
} from "../lib/officialGamePresentation";

function OfficialGamePresentation({ game, renderFinal, onPresentationComplete }) {
  const [now, setNow] = useState(Date.now());
  const [statsView, setStatsView] = useState("team");
  const finalizationRequested = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  const frame = getPresentationFrame(game, now);
  const authoritativeFrame = getAuthoritativePresentationFrame(game, now);

  useEffect(() => { finalizationRequested.current = false; }, [game.id]);
  useEffect(() => {
    if (game.status !== "in_progress" || !authoritativeFrame.finished || !onPresentationComplete || finalizationRequested.current) return;
    finalizationRequested.current = true;
    Promise.resolve(onPresentationComplete(game)).catch(() => { finalizationRequested.current = false; });
  }, [authoritativeFrame.elapsedMs, authoritativeFrame.finished, game, onPresentationComplete]);

  const stats = useMemo(() => getProgressivePlayerStats(frame.visibleEvents), [frame.visibleEvents]);
  const players = useMemo(() => [
    ...(game.boxScore?.away?.players || []).map((player) => ({ ...player, side: "away" })),
    ...(game.boxScore?.home?.players || []).map((player) => ({ ...player, side: "home" })),
  ], [game.boxScore?.away?.players, game.boxScore?.home?.players]);
  const playersById = useMemo(() => new Map(players.map((player) => [String(player.playerId), player])), [players]);
  const event = frame.currentEvent;

  if (!game.timeline?.length) return game.status === "completed" ? renderFinal() : <p className="official-live__preparing">Preparing gamecast...</p>;

  return (
    <div className="official-live">
      <LiveScoreboard game={game} event={event} />
      <BreakState event={event} game={game} />
      <div className="gamecast-layout">
        <main className="gamecast-main">
          <div className="gamecast-story">
            <CurrentPossession event={event} game={game} playersById={playersById} />
            <LastPlay event={event} game={game} playersById={playersById} />
          </div>
          <PlayByPlayFeed events={frame.visibleEvents} game={game} playersById={playersById} />
        </main>
        <aside className="gamecast-support">
          <MomentumPanel events={frame.visibleEvents} game={game} />
          <GameLeaders players={players} stats={stats} />
        </aside>
      </div>
      <section className="gamecast-stats">
        <div className="gamecast-tabs" role="tablist" aria-label="Live game statistics">
          <button type="button" role="tab" aria-selected={statsView === "team"} className={statsView === "team" ? "is-active" : ""} onClick={() => setStatsView("team")}>TEAM STATS</button>
          <button type="button" role="tab" aria-selected={statsView === "players"} className={statsView === "players" ? "is-active" : ""} onClick={() => setStatsView("players")}>PLAYER STATS</button>
        </div>
        <div role="tabpanel">{statsView === "team" ? <TeamStatsComparison players={players} stats={stats} game={game} /> : <PlayerStatsTable players={players} stats={stats} />}</div>
      </section>
      {authoritativeFrame.finished && game.status === "completed" ? renderFinal() : frame.finished ? <p className="official-live__finalizing">Finalizing official result...</p> : null}
    </div>
  );
}

export default OfficialGamePresentation;
