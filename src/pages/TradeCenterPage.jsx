import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import TradeComparison from "../components/trade/TradeComparison";
import TradeOffer from "../components/trade/TradeOffer";
import TradePlayerCard from "../components/trade/TradePlayerCard";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { db } from "../lib/firebase";
import { createTradeOffer } from "../lib/trades";

function TradeCenterPage() {
  const { user } = useAuth();
  const { activeLeagueId, members } = useLeague();
  const { roster, leagueTeam } = useLeagueTeam();
  const [yourOffer, setYourOffer] = useState([]);
  const [theirOffer, setTheirOffer] = useState([]);
  const [teams, setTeams] = useState([]);
  const [ownership, setOwnership] = useState(new Map());
  const [receiverUid, setReceiverUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!activeLeagueId) {
      setTeams([]);
      setOwnership(new Map());
      return undefined;
    }
    const unsubscribeTeams = onSnapshot(
      collection(db, "leagues", activeLeagueId, "teams"),
      (snapshot) => setTeams(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setTeams([]),
    );
    const unsubscribeOwnership = onSnapshot(
      collection(db, "leagues", activeLeagueId, "playerOwnership"),
      (snapshot) => setOwnership(new Map(snapshot.docs.map((item) => [item.id, item.data().ownerUid]))),
      () => setOwnership(new Map()),
    );
    return () => { unsubscribeTeams(); unsubscribeOwnership(); };
  }, [activeLeagueId]);

  const opponentTeams = useMemo(() => teams.filter((team) => team.id !== user?.uid), [teams, user?.uid]);
  const opponentTeam = teams.find((team) => team.id === receiverUid) || null;
  const ownedPlayers = useMemo(() => roster.filter((player) => ownership.get(String(player.id)) === user?.uid), [ownership, roster, user?.uid]);
  const opponentPlayers = useMemo(() => (opponentTeam?.roster || []).filter((player) => ownership.get(String(player.id)) === receiverUid), [opponentTeam, ownership, receiverUid]);
  const toggle = (player, setOffer) => setOffer((current) => current.some((item) => item.id === player.id) ? current.filter((item) => item.id !== player.id) : [...current, player]);
  const remove = (id, setOffer) => setOffer((current) => current.filter((player) => player.id !== id));
  const cancel = () => { setYourOffer([]); setTheirOffer([]); setError(""); setSuccess(""); };
  async function submitOffer() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const tradeId = await createTradeOffer({ leagueId: activeLeagueId, senderUid: user.uid, receiverUid, offeredPlayerIds: yourOffer.map((player) => player.id), requestedPlayerIds: theirOffer.map((player) => player.id) });
      setYourOffer([]);
      setTheirOffer([]);
      setSuccess(`Trade offer ${tradeId.slice(0, 8).toUpperCase()} was sent.`);
    } catch (nextError) {
      setError(nextError.message || "Could not create this trade offer.");
    } finally {
      setBusy(false);
    }
  }
  const canSubmit = Boolean(activeLeagueId && user && receiverUid && yourOffer.length && theirOffer.length && !busy);
  return <PageLayout><div className="trade-center">
    <section className="trade-center__hero"><div><p className="section-label">FRANCHISE TRANSACTION HUB</p><h1>Trade <span>Center.</span></h1><p>Build a real pending offer from league-owned players. Offers are validated against canonical player ownership and do not move rosters until a future acceptance phase.</p></div><div className="trade-center__hero-tag"><span>TRADE MACHINE</span><b>PENDING OFFERS</b><small>Acceptance is not available yet.</small></div></section>
    <section className="trade-recipient"><label>TRADE PARTNER<select value={receiverUid} onChange={(event) => { setReceiverUid(event.target.value); setTheirOffer([]); setError(""); setSuccess(""); }}><option value="">Select a league franchise</option>{opponentTeams.map((team) => <option key={team.id} value={team.id}>{team.name || members.find((member) => member.uid === team.id)?.displayName || "Franchise"}</option>)}</select></label><div><span>YOUR FRANCHISE</span><b>{leagueTeam?.name || "Franchise setup"}</b><small>{ownedPlayers.length} canonically owned player{ownedPlayers.length === 1 ? "" : "s"}</small></div>{opponentTeam && <div><span>TRADE PARTNER</span><b>{opponentTeam.name || "Franchise"}</b><small>{opponentPlayers.length} canonically owned player{opponentPlayers.length === 1 ? "" : "s"}</small></div>}</section>
    <section className="trade-center__workspace"><aside className="trade-pool"><header><span>YOUR PLAYERS</span><b>Build your offer</b><small>{ownedPlayers.length} available</small></header>{ownedPlayers.length ? ownedPlayers.map((player) => <TradePlayerCard key={player.id} player={player} selected={yourOffer.some((item) => item.id === player.id)} onToggle={(next) => toggle(next, setYourOffer)} />) : <p className="trade-pool__empty">No canonically owned roster players are available. Existing rosters may require ownership backfill.</p>}</aside>
      <main className="trade-center__main"><div className="trade-offers"><TradeOffer title="YOUR OFFER" players={yourOffer} onRemove={(id) => remove(id, setYourOffer)} emptyText="Select owned players from your roster." /><div className="trade-offers__arrow" aria-hidden="true">⇄</div><TradeOffer title="THEIR OFFER" players={theirOffer} onRemove={(id) => remove(id, setTheirOffer)} emptyText="Select players from a league franchise." /></div><TradeComparison yours={yourOffer} theirs={theirOffer} /><div className="trade-center__actions"><button type="button" onClick={cancel} disabled={busy}>Cancel trade</button><button type="button" onClick={() => { void submitOffer(); }} disabled={!canSubmit} title={canSubmit ? "Send pending trade offer" : "Select a partner and at least one player from each franchise"}>{busy ? "Sending offer..." : "Send trade offer"}</button></div>{error && <p className="trade-center__message trade-center__message--error" role="alert">{error}</p>}{success && <p className="trade-center__message" role="status">{success}</p>}</main>
      <aside className="trade-pool trade-pool--opponent"><header><span>TRADE PARTNER PLAYERS</span><b>{opponentTeam?.name || "Select a franchise"}</b><small>{receiverUid ? `${opponentPlayers.length} available` : "Choose a partner"}</small></header>{!receiverUid ? <p className="trade-pool__empty">Select a league franchise to view its canonically owned roster.</p> : opponentPlayers.length ? opponentPlayers.map((player) => <TradePlayerCard key={player.id} player={player} selected={theirOffer.some((item) => item.id === player.id)} onToggle={(next) => toggle(next, setTheirOffer)} actionLabel="Add target" />) : <p className="trade-pool__empty">This franchise has no canonically owned players available.</p>}</aside>
    </section>
  </div></PageLayout>;
}
export default TradeCenterPage;
