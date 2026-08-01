import { PLAYOFF_DISPLAY_STATUS, getPlayoffScore, playoffDisplayStatus } from "../../lib/playoffPresentation";

const initials = (name = "Team") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function PlayoffsHeader({ season, stage, champion }) {
  return <header className="championship-header"><div><span>FULL COURT POSTSEASON</span><h1>Playoffs</h1></div><p>Season {season} <i /> Road to the Championship</p><small>{champion ? "Championship complete" : stage}</small></header>;
}

export function ChampionshipProgress({ champion }) {
  return <ol className="championship-progress" aria-label="Championship progress"><li className="is-complete"><i>✓</i><span>Regular Season</span></li><li className={champion ? "is-complete" : "is-current"}><i>{champion ? "✓" : "•"}</i><span>Playoffs</span></li><li className={champion ? "is-complete is-current" : ""}><i>{champion ? "✓" : "○"}</i><span>Champion</span></li></ol>;
}

function FeaturedTeam({ name, seed, score, side, winner }) {
  return <div className={`featured-playoff-team featured-playoff-team--${side} ${winner ? "is-winner" : ""}`}><i aria-hidden="true">{initials(name)}</i><div><small>SEED #{seed}</small><h2 title={name}>{name}</h2></div>{score != null && <strong>{score}</strong>}</div>;
}

export function FeaturedPlayoffMatchup({ game, now, action }) {
  if (!game) return null;
  const status = playoffDisplayStatus(game, now);
  const score = getPlayoffScore(game, now);
  const finalVisible = status === PLAYOFF_DISPLAY_STATUS.FINAL;
  return <section className={`featured-playoff is-${status.toLowerCase()}`}><header><span>FEATURED MATCHUP</span><b className={`playoff-status playoff-status--${status.toLowerCase()}`}>{status}</b><small>{game.stage === "final" ? "League Final" : "Semifinal"}</small></header><div className="featured-playoff__stage"><FeaturedTeam name={game.homeTeamName} seed={game.homeSeed} score={score?.home} side="home" winner={finalVisible && game.result?.winnerUid === game.homeUid} /><div className="featured-playoff__center"><b>VS</b>{score && <small>{score.phase} {score.clock}</small>}</div><FeaturedTeam name={game.awayTeamName} seed={game.awaySeed} score={score?.away} side="away" winner={finalVisible && game.result?.winnerUid === game.awayUid} /></div><p>{game.stage === "final" ? "One official game decides the league championship." : "Win and advance to the League Final."}</p>{action && <div className="featured-playoff__action">{action}</div>}</section>;
}

export function BracketGameCard({ game, now, currentUid, onOpen }) {
  if (!game) return <article className="bracket-card is-pending"><span>LEAGUE FINAL</span><h3>Awaiting semifinal winners</h3><small>Matchup will lock after both trusted results.</small></article>;
  const status = playoffDisplayStatus(game, now);
  const score = getPlayoffScore(game, now);
  const participant = game.homeUid === currentUid || game.awayUid === currentUid;
  const canOpen = participant && [PLAYOFF_DISPLAY_STATUS.LIVE, PLAYOFF_DISPLAY_STATUS.FINAL].includes(status);
  return <article className={`bracket-card is-${status.toLowerCase()}`}><header><span>{game.stage === "final" ? "LEAGUE FINAL" : game.playoffGameKey?.toUpperCase()}</span><b className={`playoff-status playoff-status--${status.toLowerCase()}`}>{status}</b></header><div className={score && game.result?.winnerUid === game.homeUid && status === PLAYOFF_DISPLAY_STATUS.FINAL ? "is-winner" : ""}><b><i>#{game.homeSeed}</i><span title={game.homeTeamName}>{game.homeTeamName}</span></b><strong>{score?.home ?? "–"}</strong></div><div className={score && game.result?.winnerUid === game.awayUid && status === PLAYOFF_DISPLAY_STATUS.FINAL ? "is-winner" : ""}><b><i>#{game.awaySeed}</i><span title={game.awayTeamName}>{game.awayTeamName}</span></b><strong>{score?.away ?? "–"}</strong></div><footer><small>{score ? `${score.phase} ${score.clock}` : "Single elimination"}</small>{canOpen && <button onClick={() => onOpen(game)} type="button">{status === PLAYOFF_DISPLAY_STATUS.LIVE ? "Watch" : "View"}</button>}</footer></article>;
}

export function ChampionCard({ postseason, season, finalGame, commissioner, busy, onOffseason }) {
  return <section className="championship-winner"><i aria-hidden="true">♛</i><div><span>SEASON {season} CHAMPION</span><h2>{postseason.champion.teamName}</h2><p>Seed #{postseason.champion.seed} · Runner-up: {postseason.runnerUp.teamName}</p>{finalGame?.result && <small>League Final · {finalGame.homeTeamName} {finalGame.result.homeScore}–{finalGame.result.awayScore} {finalGame.awayTeamName}</small>}</div>{commissioner ? <button className="button-primary" disabled={busy} onClick={onOffseason} type="button">{busy ? "Creating Season History..." : "Enter Offseason"}</button> : <b>Waiting for the commissioner</b>}</section>;
}

export function UserPlayoffState({ outcome }) {
  if (!outcome || outcome.state === "active" || outcome.state === "champion") return null;
  return <aside className="user-playoff-state"><span>{outcome.label}</span><b>{outcome.finish}</b><small>The championship bracket remains live below.</small></aside>;
}

export function PlayoffResults({ games, now }) {
  const finals = games.filter((game) => playoffDisplayStatus(game, now) === PLAYOFF_DISPLAY_STATUS.FINAL);
  if (!finals.length) return null;
  return <section className="playoff-results"><header><span>COMPLETED MATCHUPS</span><h2>Postseason Results</h2></header><div>{finals.map((game) => {
    const winnerHome = game.result.winnerUid === game.homeUid;
    return <article key={game.id}><span>{game.stage === "final" ? "LEAGUE FINAL" : "SEMIFINAL"}</span><b>{winnerHome ? game.homeTeamName : game.awayTeamName}</b><small>def. {winnerHome ? game.awayTeamName : game.homeTeamName}</small><strong>{winnerHome ? game.result.homeScore : game.result.awayScore}–{winnerHome ? game.result.awayScore : game.result.homeScore}</strong></article>;
  })}</div></section>;
}
