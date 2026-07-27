import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import { db } from "../lib/firebase";

function LeagueLobbyPage() {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const {
    activeLeagueId,
    activeLeague,
    members: activeMembers,
    leagueLoading,
    joinLeague,
  } = useLeague();
  const navigate = useNavigate();
  const [inviteLeague, setInviteLeague] = useState(null);
  const [inviteMembers, setInviteMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isActiveLeague = activeLeagueId === leagueId;
  const league = isActiveLeague ? activeLeague : inviteLeague;
  const members = isActiveLeague ? activeMembers : inviteMembers;
  const isMember = Boolean(league?.memberIds?.includes(user.uid));

  useEffect(() => {
    if (isActiveLeague) {
      setLoading(false);
      return undefined;
    }
    setInviteLeague(null);
    setInviteMembers([]);
    setError("");
    setLoading(true);
    return onSnapshot(
      doc(db, "leagues", leagueId),
      (snapshot) => {
        setInviteLeague(
          snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        );
        if (!snapshot.exists()) setError("No league was found with this invite link.");
        setLoading(false);
      },
      () => {
        setError("This league invite is unavailable.");
        setLoading(false);
      },
    );
  }, [isActiveLeague, leagueId]);

  useEffect(() => {
    if (isActiveLeague || !isMember) {
      setInviteMembers([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, "leagues", leagueId, "members"), orderBy("joinedAt")),
      (snapshot) =>
        setInviteMembers(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
        ),
      () => setError("Could not load league members."),
    );
  }, [isActiveLeague, isMember, leagueId]);

  async function join() {
    setError("");
    setBusy(true);
    try {
      await joinLeague(leagueId);
      navigate(`/league/${leagueId}`, { replace: true });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  const inviteLink = `${window.location.origin}/league/${leagueId}`;
  const memberCount = isMember ? members.length : league?.memberIds?.length || 0;

  if (loading || (isActiveLeague && leagueLoading)) return <PageLayout><div className="route-loader">Loading league headquarters...</div></PageLayout>;
  if (!league) return <PageLayout><section className="empty-state"><h2>League unavailable.</h2><p>{error}</p><Link to="/league">League HQ</Link></section></PageLayout>;
  return <PageLayout><section className="page-hero league-hero"><p className="section-label">PRIVATE LEAGUE / SEASON {league.season}</p><h1>{league.name}<span>.</span></h1><p>{league.status === "lobby" ? "The league lobby is open. Invite every franchise before the draft begins." : "League season in progress."}</p></section><section className="league-lobby"><div className="league-code"><span>INVITE CODE</span><b>{league.inviteCode}</b><small>{inviteLink}</small></div><div className="league-status"><span>LEAGUE STATUS</span><b>{league.status.toUpperCase()}</b><small>{memberCount}/{league.maxMembers} teams joined</small></div><div className="league-next"><span>NEXT PHASE</span><b>FANTASY DRAFT</b><small>Available once the lobby is full.</small></div></section>{isMember && <section className="franchise-list"><div className="section-heading"><div><p className="section-label">FRANCHISES</p><h2>League members <span>{memberCount}/{league.maxMembers} joined</span></h2></div></div>{members.map((member, index) => <article key={member.id}><strong>0{index + 1}</strong><span>{member.role === "commissioner" ? "COMMISSIONER" : "FRANCHISE OWNER"}</span><b>{member.displayName}</b><i>{member.uid === league.commissionerUid ? "HOST" : "MEMBER"}</i></article>)}{Array.from({ length: Math.max(0, league.maxMembers - memberCount) }).map((_, index) => <article className="franchise-list__empty" key={`empty-${index}`}><strong>--</strong><span>OPEN FRANCHISE</span><b>Waiting for invite</b></article>)}</section>}{league.status === "lobby" && !isMember && <section className="league-join"><p>Use this invite to reserve your franchise.</p><button onClick={join} disabled={busy}>{busy ? "Joining..." : "Join this league"}</button></section>}{error && <p className="league-error" role="alert">{error}</p>}</PageLayout>;
}

export default LeagueLobbyPage
