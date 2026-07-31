import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PlayerCard from "../components/PlayerCard";
import PlayerImage from "../components/player/PlayerImage";
import useAuth from "../hooks/useAuth";
import useDraft from "../hooks/useDraft";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import usePlayers from "../hooks/usePlayers";
import usePlayerSearch from "../hooks/usePlayerSearch";
import { DRAFT_STATUS } from "../lib/draft";
import { DraftProvider } from "../context/DraftContext";
import { PlayersProvider } from "../context/PlayersContext";
import { normalizeRosterConfig } from "../lib/rosterConfig";
import { getDraftRosterFeasibility } from "../lib/lineupFeasibility";
import { getUserFriendlyError } from "../lib/clientErrors";
import { draftTurnIdentity, formatDraftClock, getDraftRemainingSeconds } from "../lib/draftTimer";

const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];
const DRAFT_PAGE_SIZE = 48;

function DraftPageContent() {
  const { user } = useAuth();
  const { activeLeagueId, activeLeague, members } = useLeague();
  const { roster } = useLeagueTeam();
  const {
    draft, picks, draftedPlayerIds, draftLoading, draftError, makePick,
    resolveExpiredPick, serverTimeOffsetMs,
  } = useDraft();
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
  const [visibleCount, setVisibleCount] = useState(DRAFT_PAGE_SIZE);
  const [clockNowMs, setClockNowMs] = useState(Date.now());
  const [autoResolving, setAutoResolving] = useState(false);
  const resolvingTurnRef = useRef("");
  const rosterSize = normalizeRosterConfig(activeLeague).rosterSize;
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
  const memberById = useMemo(() => new Map(
    members.map((member) => [member.uid || member.id, member]),
  ), [members]);
  const isYourPick =
    draft?.status === DRAFT_STATUS.ACTIVE &&
    draft.currentDrafterUid === user?.uid;
  const currentDrafter = memberById.get(draft?.currentDrafterUid);
  const firestoreCatalogReady = catalogSource === "firestore";
  const visiblePlayers = availablePlayers.slice(0, visibleCount);
  const rosterFeasibility = getDraftRosterFeasibility(roster, rosterSize);
  const turnIdentity = useMemo(() => draftTurnIdentity(draft), [draft]);
  const turnKey = `${turnIdentity.pickNumber || ""}:${turnIdentity.drafterUid || ""}:${turnIdentity.deadlineMs || ""}`;
  const remainingSeconds = getDraftRemainingSeconds(draft?.pickDeadlineAt, serverTimeOffsetMs, clockNowMs);
  const timerExpired = draft?.status === DRAFT_STATUS.ACTIVE && remainingSeconds === 0;
  const timerLoading = draft?.status === DRAFT_STATUS.ACTIVE && !draft.pickDeadlineAt;

  useEffect(() => setVisibleCount(DRAFT_PAGE_SIZE), [position, search, sortBy]);

  useEffect(() => {
    if (draft?.status !== DRAFT_STATUS.ACTIVE || !draft.pickDeadlineAt) return undefined;
    setClockNowMs(Date.now());
    const intervalId = window.setInterval(() => setClockNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [draft?.pickDeadlineAt, draft?.status]);

  useEffect(() => {
    setAutoResolving(false);
    resolvingTurnRef.current = "";
  }, [turnKey]);

  useEffect(() => {
    if (!timerExpired || !turnIdentity.deadlineMs || resolvingTurnRef.current === turnKey) return;
    resolvingTurnRef.current = turnKey;
    setAutoResolving(true);
    void resolveExpiredPick(turnIdentity)
      .catch((error) => setPickError(getUserFriendlyError(error, "The expired pick is being resolved.")))
      .finally(() => setAutoResolving(false));
  }, [resolveExpiredPick, timerExpired, turnIdentity, turnKey]);

  const selectPlayer = useCallback(async (player) => {
    setPickError("");
    setBusyPlayerId(player.id);
    try {
      await makePick(player.id);
    } catch (error) {
      setPickError(getUserFriendlyError(error, "The draft pick could not be completed."));
    } finally {
      setBusyPlayerId(null);
    }
  }, [makePick]);

  if (draftLoading || timerLoading) {
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
            <time className={`draft-pick-clock ${remainingSeconds !== null && remainingSeconds <= 10 ? "is-urgent" : ""}`} dateTime={`PT${remainingSeconds ?? 0}S`}>
              {autoResolving || timerExpired ? "AUTO-PICKING" : formatDraftClock(remainingSeconds)}
            </time>
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
                  <span><b>{pick.player.name}</b><small>{memberById.get(pick.ownerUid)?.displayName || pick.ownerUid} · RD {pick.round}{pick.selectionType === "auto" ? " · AUTO" : ""}</small></span>
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
            {fallbackUsed && <div className="player-database__empty">The player list is currently unavailable for draft picks.</div>}
            <section className="draft-coverage"><header><span>STARTING FIVE COVERAGE</span><small>{rosterFeasibility.valid ? "LEGAL FIVE AVAILABLE" : `${rosterFeasibility.remainingSlots} ROSTER SLOTS REMAIN`}</small></header><div>{positions.slice(1).map((slot) => <span className={rosterFeasibility.assignment[slot] ? "is-covered" : "is-missing"} key={slot}><b>{slot}</b>{rosterFeasibility.assignment[slot] ? "Covered" : "Missing"}</span>)}</div>{!rosterFeasibility.valid && <p>You still need coverage for {rosterFeasibility.uncoveredPositions.join(", ")} to build a legal Starting Five.</p>}</section>
            {pickError && <div className="draft-pick-error" role="alert">{pickError}</div>}
            {catalogEmpty || playersError ? (
              <div className="player-database__empty">Player catalog is unavailable.</div>
            ) : playersLoading ? (
              <div className="player-database__empty">Loading draft pool...</div>
            ) : availablePlayers.length ? (
              <div className="draft-player-grid">
                {visiblePlayers.map((player) => {
                  const candidateFeasibility = getDraftRosterFeasibility([...roster, player], rosterSize);
                  const compositionBlocked = !candidateFeasibility.canStillBecomeValid;
                  return <PlayerCard
                    key={player.id}
                    player={player}
                    onAction={selectPlayer}
                    disabled={!isYourPick || timerExpired || !firestoreCatalogReady || roster.length >= rosterSize || busyPlayerId !== null || compositionBlocked}
                    actionLabel={busyPlayerId === player.id ? "Drafting..." : timerExpired ? "Auto-picking..." : compositionBlocked ? `Needs ${candidateFeasibility.uncoveredPositions.join("/")}` : isYourPick ? "Draft player" : "Waiting for pick"}
                  />;
                })}
              </div>
            ) : <div className="player-database__empty">No available players match this search.</div>}
            {visibleCount < availablePlayers.length && <button className="draft-load-more button-secondary" type="button" onClick={() => setVisibleCount((count) => count + DRAFT_PAGE_SIZE)}>Load More Players ({availablePlayers.length - visibleCount} remaining)</button>}
          </main>

          <aside className="draft-selected">
            <header><span>YOUR ROSTER</span><b>Drafted unit</b><i>{roster.length}/{rosterSize}</i></header>
            {roster.length ? roster.map((player, index) => (
              <div className="draft-selected__player" style={{ "--draft-player": player.color || "#e32842" }} key={player.id}>
                <strong>{String(index + 1).padStart(2, "0")}</strong><PlayerImage player={player} alt="" />
                <span><small>{player.position} · {player.team}</small><b>{player.name}</b></span><em>{player.overall}</em>
              </div>
            )) : <div className="draft-selected__empty"><b>No selections yet.</b><p>Your drafted players will appear here.</p></div>}
          </aside>
        </section>
      </div>
    </PageLayout>
  );
}

function DraftPage() {
  return <PlayersProvider><DraftProvider><DraftPageContent /></DraftProvider></PlayersProvider>;
}

export default DraftPage;
