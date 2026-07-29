import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import useAuth from "../hooks/useAuth";
import useDraft from "../hooks/useDraft";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";
import usePlayerSearch from "../hooks/usePlayerSearch";
import { DRAFT_STATUS } from "../lib/draft";

const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];

function DraftPage() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, members } = useLeague();
  const { roster } = useLeagueTeam();
  const { draft, picks, draftedPlayerIds, draftLoading, draftError, makePick } =
    useDraft();
  const {
    players,
    playersLoading,
    playersError,
    catalogSource,
    fallbackUsed,
    catalogEmpty,
  } = usePlayers();
  const [position, setPosition] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("overall");
  const [busyPlayerId, setBusyPlayerId] = useState(null);
  const [pickError, setPickError] = useState("");
  const searchedPlayers = usePlayerSearch(players, search, position);
  const availablePlayers = useMemo(
    () =>
      searchedPlayers
        .filter((player) => !draftedPlayerIds.has(String(player.id)))
        .toSorted((first, second) =>
          sortBy === "position"
            ? first.position.localeCompare(second.position) ||
              second.overall - first.overall
            : second.overall - first.overall,
        ),
    [draftedPlayerIds, searchedPlayers, sortBy],
  );
  const memberById = new Map(
    members.map((member) => [member.uid || member.id, member]),
  );
  const isYourPick =
    draft?.status === DRAFT_STATUS.ACTIVE &&
    draft.currentDrafterUid === user.uid;
  const currentDrafter = memberById.get(draft?.currentDrafterUid);
  const firestoreCatalogReady = catalogSource === "firestore";

  async function selectPlayer(player) {
    setPickError("");
    setBusyPlayerId(player.id);
    try {
      await makePick(player.id);
    } catch (error) {
      setPickError(error.message || "The draft pick could not be completed.");
    } finally {
      setBusyPlayerId(null);
    }
  }

  if (draftLoading) {
    return <PageLayout><div className="route-loader">Joining the shared draft room...</div></PageLayout>;
  }

  if (!draft) {
    return (
      <PageLayout>
        <section className="empty-state">
          <h2>Shared draft state unavailable.</h2>
          <p>{draftError?.message || "The commissioner must start a newly initialized league draft."}</p>
          <Link to={`/league/${activeLeagueId}`}>Return to league dashboard</Link>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="draft-center">
        <section className="draft-center__hero">
          <div className="draft-center__hero-copy">
            <p className="section-label">{activeLeague?.name || "LEAGUE"} // SHARED DRAFT</p>
            <h1>Build your <span>dynasty.</span></h1>
            <p>Every selection is synchronized across the league and permanently advances the shared snake draft.</p>
            <div className="draft-center__links"><Link to={`/league/${activeLeagueId}`}>← League Dashboard</Link></div>
          </div>
          <div className={`draft-center__pick ${isYourPick ? "is-your-pick" : ""}`}>
            <span>OVERALL PICK</span>
            <b>{draft.currentPickNumber}<i>RD {draft.currentRound}</i></b>
            <small>{currentDrafter?.displayName || draft.currentDrafterUid}</small>
            <div><i /><span>{isYourPick ? "YOUR PICK" : "WAITING FOR DRAFTER"}</span></div>
          </div>
        </section>

        <section className="draft-center__board" aria-label="Shared draft board">
          <aside className="draft-order">
            <header><span>SNAKE ORDER</span><b>Round {draft.currentRound}</b></header>
            {draft.draftOrder.map((memberId, index) => (
              <div className={memberId === draft.currentDrafterUid ? "is-current" : ""} key={memberId}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <span>{memberById.get(memberId)?.displayName || memberId}</span>
                <small>{memberId === draft.currentDrafterUid ? "ON THE CLOCK" : index % 2 === 0 ? "ODD ROUND" : "DRAFT ORDER"}</small>
              </div>
            ))}
            <section className="draft-history">
              <header><span>PICK HISTORY</span><b>{picks.length} selections</b></header>
              {picks.length ? picks.map((pick) => (
                <div key={pick.id}>
                  <strong>#{pick.overallPick}</strong>
                  <span><b>{pick.player.name}</b><small>{memberById.get(pick.ownerUid)?.displayName || pick.ownerUid} · RD {pick.round}</small></span>
                </div>
              )) : <p>No picks have been made.</p>}
            </section>
          </aside>

          <main className="draft-available">
            <header className="draft-available__head">
              <div><span>AVAILABLE PLAYERS</span><h2>Draft pool <i>{playersLoading ? "Loading" : `${availablePlayers.length} prospects`}</i></h2></div>
              <div className="draft-sort"><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="overall">Overall rating</option><option value="position">Position</option></select></label></div>
            </header>
            <div className="draft-filters">
              <label className="draft-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player or team" /></label>
              <div className="draft-position-filters">{positions.map((item) => <button type="button" key={item} className={position === item ? "is-active" : ""} onClick={() => setPosition(item)}>{item}</button>)}</div>
            </div>
            {fallbackUsed && <div className="player-database__empty">The local fallback is view-only. Draft picks require the published Firestore catalog.</div>}
            {pickError && <div className="draft-pick-error" role="alert">{pickError}</div>}
            {catalogEmpty || playersError ? (
              <div className="player-database__empty">Player catalog is unavailable.</div>
            ) : playersLoading ? (
              <div className="player-database__empty">Loading draft pool...</div>
            ) : availablePlayers.length ? (
              <div className="draft-player-grid">
                {availablePlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onAction={selectPlayer}
                    disabled={!isYourPick || !firestoreCatalogReady || roster.length >= 5 || busyPlayerId !== null}
                    actionLabel={busyPlayerId === player.id ? "Drafting..." : isYourPick ? "Draft player" : "Waiting for pick"}
                  />
                ))}
              </div>
            ) : <div className="player-database__empty">No available players match this search.</div>}
          </main>

          <aside className="draft-selected">
            <header><span>YOUR ROSTER</span><b>Drafted unit</b><i>{roster.length}/5</i></header>
            {roster.length ? roster.map((player, index) => (
              <div className="draft-selected__player" style={{ "--draft-player": player.color || "#e32842" }} key={player.id}>
                <strong>{String(index + 1).padStart(2, "0")}</strong><img src={player.image} alt="" />
                <span><small>{player.position} · {player.team}</small><b>{player.name}</b></span><em>{player.overall}</em>
              </div>
            )) : <div className="draft-selected__empty"><b>No selections yet.</b><p>Your drafted players will appear here.</p></div>}
          </aside>
        </section>
      </div>
    </PageLayout>
  );
}

export default DraftPage;
