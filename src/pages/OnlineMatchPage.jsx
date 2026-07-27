import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { createMatchRoom } from "../lib/matches";
import { getMissingLineupPositions, isLineupComplete } from "../utils/team";

function OnlineMatchPage() {
  const { user } = useAuth();
  const { activeLeagueId, roster, lineup } = useLeagueTeam();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const missingPositions = getMissingLineupPositions(roster, lineup);
  const lineupReady = isLineupComplete(roster, lineup);

  async function createRoom() {
    setError("");
    setCreating(true);
    try {
      const match = await createMatchRoom({
        user,
        leagueId: activeLeagueId,
        roster,
        lineup,
      });
      navigate(`/match/${match.id}`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageLayout>
      <section className="page-hero online-hero">
        <p className="section-label">ONLINE PLAY</p>
        <h1>
          Challenge a <span>friend.</span>
        </h1>
        <p>
          Create a private room, share its invite link, then lock in your
          starting five.
        </p>
      </section>
      <section className="online-create">
        <div>
          <span className="online-icon">VS</span>
          <p className="section-label">PRIVATE MATCH ROOM</p>
          <h2>Ready to defend your court?</h2>
          <p>
            Your current five-player roster will be saved as a match snapshot
            when the room is created.
          </p>
        </div>
        <button onClick={createRoom} disabled={creating || !lineupReady}>
          {creating ? "Creating room..." : "Create invite room"}
        </button>
        {!lineupReady && (
          <small>Missing positions: {missingPositions.join(", ")}.</small>
        )}
        {error && (
          <p className="online-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </PageLayout>
  );
}

export default OnlineMatchPage;
