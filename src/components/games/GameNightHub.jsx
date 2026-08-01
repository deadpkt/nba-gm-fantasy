import { Link } from "react-router-dom";
import { GAME_HUB_STATUS, getVisibleGameScore } from "../../lib/gamesHub";

const initials = (name = "Team") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function GamesHeader({ season, progress, remaining }) {
  return <header className="game-night-header"><div><span>OFFICIAL LEAGUE GAMES</span><h1>Games</h1></div><p>Season {season} <i /> Regular Season <i /> Round {progress.currentRound}</p>{remaining > 0 && <small>{remaining} {remaining === 1 ? "game" : "games"} remaining in this round</small>}</header>;
}

function TeamSide({ name, row, side }) {
  return <div className={`featured-team featured-team--${side}`}><i aria-hidden="true">{initials(name)}</i><div><small>{side.toUpperCase()}</small><h2 title={name}>{name}</h2><p>{row ? `${row.wins}-${row.losses}` : "0-0"}{row?.rank ? ` · #${row.rank} seed` : ""}</p></div></div>;
}

export function FeaturedMatchup({ game, status, score, standings, storyline, action }) {
  if (!game) return <section className="featured-matchup featured-matchup--empty"><span>BYE WEEK</span><h2>No game this round.</h2><p>Follow the rest of the league action below.</p><a className="button-secondary" href="#round-scoreboard">View Round Games</a></section>;
  const home = standings.find((row) => row.teamUid === game.homeUid);
  const away = standings.find((row) => row.teamUid === game.awayUid);
  return <section className={`featured-matchup is-${status.toLowerCase()}`}>
    <header><span>YOUR FEATURED MATCHUP</span><b className={`hub-status hub-status--${status.toLowerCase()}`}>{status}</b><small>Round {game.round} · Game {game.gameNumber}</small></header>
    <div className="featured-matchup__stage">
      <TeamSide name={game.homeTeamName} row={home} side="home" />
      <div className="featured-matchup__center">{score ? <><strong>{score.home}<i>–</i>{score.away}</strong><small>{score.phase} {score.clock}</small></> : <><b>VS</b><small>{status}</small></>}</div>
      <TeamSide name={game.awayTeamName} row={away} side="away" />
    </div>
    {storyline && <p className="matchup-storyline">{storyline}</p>}
    {action && <div className="featured-matchup__action">{action}</div>}
  </section>;
}

export function RoundScoreboard({ games, currentUid, currentRound, now, statusFor, onOpen, sectionId, showHeader = true }) {
  return <section className="game-night-section" id={sectionId}>{showHeader && <header><div><span>LEAGUE SCOREBOARD</span><h2>Round {currentRound}</h2></div></header>}<div className="round-scoreboard">{games.map((game) => {
    const status = statusFor(game);
    const score = getVisibleGameScore(game, now);
    const userGame = game.homeUid === currentUid || game.awayUid === currentUid;
    const canOpen = userGame && [GAME_HUB_STATUS.LIVE, GAME_HUB_STATUS.FINAL].includes(status);
    return <article className={userGame ? "is-user-game" : ""} key={game.id}>
      <span className={`hub-status hub-status--${status.toLowerCase()}`}>{status}</span>
      <div className="scoreboard-team"><b title={game.awayTeamName}>{game.awayTeamName}</b><strong>{score?.away ?? "–"}</strong></div>
      <i>at</i>
      <div className="scoreboard-team"><b title={game.homeTeamName}>{game.homeTeamName}</b><strong>{score?.home ?? "–"}</strong></div>
      {userGame && <small>YOUR GAME</small>}
      {canOpen && <button type="button" onClick={() => onOpen(game)}>{status === GAME_HUB_STATUS.LIVE ? "Watch" : "Box Score"}</button>}
    </article>;
  })}</div></section>;
}

export function SeasonTimeline({ items, onOpen }) {
  return <section className="game-night-section season-path"><header><div><span>YOUR SEASON</span><h2>Season Timeline</h2></div></header><div className="season-path__rail">{items.map((item) => {
    const actionable = ["W", "L", GAME_HUB_STATUS.LIVE].includes(item.state);
    return <button className={`season-stop is-${item.state.toLowerCase()}`} disabled={!actionable} key={item.game.id} onClick={() => actionable && onOpen(item.game)} type="button"><span>R{item.round}</span><b>{item.state}</b><small>{item.score || (item.state === GAME_HUB_STATUS.UPCOMING ? "NEXT" : item.state)}</small></button>;
  })}</div></section>;
}

export function StakesPanel({ userRow, opponentRow }) {
  if (!userRow) return null;
  return <section className="game-night-section stakes-panel"><header><div><span>WHAT'S AT STAKE</span><h2>League Position</h2></div><Link to="/standings">View Standings</Link></header><div><p><small>CURRENT SEED</small><strong>#{userRow.rank}</strong></p><p><small>YOUR RECORD</small><strong>{userRow.wins}-{userRow.losses}</strong></p><p><small>STREAK</small><strong>{userRow.streak}</strong></p>{opponentRow && <p><small>OPPONENT SEED</small><strong>#{opponentRow.rank}</strong></p>}</div></section>;
}

export function RecentLeaders({ game, leaders }) {
  if (!game || !leaders.length) return null;
  return <section className="game-night-section recent-leaders"><header><div><span>LAST GAME</span><h2>Game Leaders</h2></div><small>{game.awayTeamName} at {game.homeTeamName}</small></header><div>{leaders.map((leader) => <article key={leader.field}><span>{leader.label}</span><strong>{leader.value}</strong><b>{leader.playerName}</b><small>{leader.teamName}</small></article>)}</div></section>;
}
