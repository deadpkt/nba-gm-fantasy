import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";
import usePlayerSearch from "../hooks/usePlayerSearch";

const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];

function DraftPage() {
  const [position, setPosition] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("overall");
  const { roster, addPlayer } = useLeagueTeam();
  const { players, playersLoading, playersError, fallbackUsed, catalogEmpty, catalogError } = usePlayers();
  const searchedPlayers = usePlayerSearch(players, search, position);
  const filteredPlayers = useMemo(() => [...searchedPlayers].sort((first, second) => sortBy === "position" ? first.position.localeCompare(second.position) || second.overall - first.overall : second.overall - first.overall), [searchedPlayers, sortBy]);
  const picksRemaining = 5 - roster.length;

  return <PageLayout><div className="draft-center">
    <section className="draft-center__hero">
      <div className="draft-center__hero-copy"><p className="section-label">LEAGUE DRAFT CENTER // SEASON 01</p><h1>Build your <span>dynasty.</span></h1><p>Scout elite talent, control the board, and assemble your game-night five.</p><div className="draft-center__links"><Link to="/league">← League HQ</Link><Link to="/my-team">Review franchise →</Link></div></div>
      <div className="draft-center__pick"><span>YOUR CURRENT PICK</span><b>{roster.length + 1}<i>RD</i></b><small>{picksRemaining > 0 ? `${picksRemaining} picks remaining` : "Starting five complete"}</small><div><i /><span>{picksRemaining > 0 ? "ON THE CLOCK" : "DRAFT COMPLETE"}</span></div></div>
    </section>
    <section className="draft-center__board" aria-label="Draft board">
      <aside className="draft-order"><header><span>DRAFT BOARD</span><b>Pick order</b></header>{Array.from({ length: 5 }, (_, index) => <div className={index === roster.length ? "is-current" : index < roster.length ? "is-complete" : ""} key={index}><strong>{String(index + 1).padStart(2, "0")}</strong><span>{roster[index]?.name || "Open selection"}</span><small>{index === roster.length ? "YOUR PICK" : index < roster.length ? "DRAFTED" : "UP NEXT"}</small></div>)}</aside>
      <main className="draft-available"><header className="draft-available__head"><div><span>AVAILABLE PLAYERS</span><h2>Draft pool <i>{playersLoading ? "Loading" : `${filteredPlayers.length} prospects`}</i></h2></div><div className="draft-sort"><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="overall">Overall rating</option><option value="position">Position</option></select></label></div></header>
        <div className="draft-filters"><label className="draft-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player or team" /></label><div className="draft-position-filters">{positions.map((item) => <button type="button" key={item} className={position === item ? "is-active" : ""} onClick={() => setPosition(item)}>{item}</button>)}</div></div>
        {fallbackUsed && <div className="player-database__empty">{catalogError?.code === "catalog-empty" ? "Local player catalog active — remote catalog is empty." : "Local player catalog active while the remote catalog is unavailable."}</div>}
        {catalogEmpty || playersError ? <div className="player-database__empty">Player catalog is unavailable. Please try again later.</div> : playersLoading ? <div className="player-database__empty">Loading draft pool...</div> : filteredPlayers.length ? <div className="draft-player-grid">{filteredPlayers.map((player) => { const drafted = roster.some((member) => member.id === player.id); return <PlayerCard key={player.id} player={player} onAction={(nextPlayer) => { void addPlayer(nextPlayer).catch((error) => console.error("Could not draft player:", error)); }} disabled={drafted || roster.length === 5} actionLabel={drafted ? "Drafted" : "Draft player"} />; })}</div> : <div className="player-database__empty">No players match this search.</div>}
      </main>
      <aside className="draft-selected"><header><span>YOUR SELECTIONS</span><b>Drafted unit</b><i>{roster.length}/5</i></header>{roster.length ? roster.map((player, index) => <div className="draft-selected__player" style={{ "--draft-player": player.color || "#e32842" }} key={player.id}><strong>{String(index + 1).padStart(2, "0")}</strong><img src={player.image} alt="" /><span><small>{player.position} · {player.team}</small><b>{player.name}</b></span><em>{player.overall}</em></div>) : <div className="draft-selected__empty"><b>Board is clear.</b><p>Make your first selection to build your unit.</p></div>}<Link to="/my-team">Set lineup →</Link></aside>
    </section>
  </div></PageLayout>;
}

export default DraftPage;
