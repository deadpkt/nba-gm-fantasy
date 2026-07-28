import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import MatchCard from "../components/season/MatchCard";
import PlayoffPicture from "../components/season/PlayoffPicture";
import SeasonOverview from "../components/season/SeasonOverview";
import StandingsTable from "../components/season/StandingsTable";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { db } from "../lib/firebase";
import { getLineupOverall } from "../utils/team";

function SeasonHubPage() {
  const { user, firebaseEnabled } = useAuth();
  const { activeLeague, activeLeagueId, members } = useLeague();
  const { leagueTeam, roster, lineup, record } = useLeagueTeam();
  const [teams, setTeams] = useState([]);
  const [recentMatch, setRecentMatch] = useState(null);
  const overall = getLineupOverall(roster, lineup);
  const teamName = leagueTeam?.name || "Your franchise";

  useEffect(() => {
    if (!firebaseEnabled || !activeLeagueId) {
      setTeams([]);
      return undefined;
    }

    return onSnapshot(
      collection(db, "leagues", activeLeagueId, "teams"),
      (snapshot) =>
        setTeams(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setTeams([]),
    );
  }, [activeLeagueId, firebaseEnabled]);

  useEffect(() => {
    if (!firebaseEnabled || !user) {
      setRecentMatch(null);
      return undefined;
    }

    return onSnapshot(
      query(
        collection(db, "users", user.uid, "matchHistory"),
        orderBy("matchDate", "desc"),
        limit(1),
      ),
      (snapshot) =>
        setRecentMatch(
          snapshot.empty
            ? null
            : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() },
        ),
      () => setRecentMatch(null),
    );
  }, [firebaseEnabled, user]);

  return (
    <PageLayout>
      <div className="season-hub">
        <section className="season-hub__hero">
          <div>
            <p className="section-label">LEAGUE SEASON HUB</p>
            <h1>Chase the <span>banner.</span></h1>
            <p>Track your franchise, league table, upcoming action, and the road to the postseason.</p>
          </div>
          <div>
            <span>SEASON STATUS</span>
            <b>{activeLeague?.status?.toUpperCase() || "OFFLINE"}</b>
            <small>{activeLeague ? `${members.length}/${activeLeague.maxMembers} franchises` : "No active league"}</small>
          </div>
        </section>
        <SeasonOverview league={activeLeague} record={record} overall={overall} teamName={teamName} />
        <div className="season-hub__grid">
          <StandingsTable
            members={members}
            teams={teams}
            currentUserId={user?.uid}
            record={record}
            overall={overall}
            teamName={teamName}
          />
          <aside className="season-schedule">
            <header><span>MATCH CENTER</span><b>Upcoming & recent</b></header>
            <MatchCard title="UPCOMING MATCH" />
            <MatchCard title="RECENT RESULT" match={recentMatch} />
          </aside>
        </div>
        <PlayoffPicture />
      </div>
    </PageLayout>
  );
}
export default SeasonHubPage;
