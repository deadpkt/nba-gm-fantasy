import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import useLeagueTeam from "../hooks/useLeagueTeam";
import { getMissingLineupPositions, isLineupComplete } from "../utils/team";

function GamesPage() {
  const { roster, lineup, record } = useLeagueTeam();
  const lineupReady = isLineupComplete(roster, lineup);
  const missingPositions = getMissingLineupPositions(roster, lineup);

  return (
    <PageLayout>
      <section className="page-hero games-hero">
        <p className="section-label">GAME CENTER</p>
        <h1>
          Choose your <span>matchup.</span>
        </h1>
        <p>
          Take on the AI, invite a friend, and return here whenever it is time
          for tip-off.
        </p>
      </section>
      <section className="game-menu">
        <GameMode
          to="/games/exhibition"
          label="SOLO PLAY"
          title="Exhibition"
          detail="Face the Court Kings and test your starting five."
          action="Play AI"
          disabled={!lineupReady}
        />
        <GameMode
          to="/games/online"
          label="ONLINE PLAY"
          title="Private Match"
          detail="Create an invite room and challenge a friend live."
          action="Challenge friend"
          disabled={!lineupReady}
        />
      </section>
      <section className="game-status">
        <div>
          <span>SEASON RECORD</span>
          <b>{record.wins}-{record.losses}</b>
        </div>
        <div>
          <span>ROSTER</span>
          <b>{roster.length}/5 PLAYERS</b>
        </div>
        <div>
          <span>LINEUP STATUS</span>
          <b>
            {lineupReady
              ? "READY FOR TIP-OFF"
              : `MISSING: ${missingPositions.join(", ")}`}
          </b>
        </div>
      </section>
    </PageLayout>
  );
}

function GameMode({ to, label, title, detail, action, disabled }) {
  const content = (
    <>
      <span>{label}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      <b>{disabled ? "COMPLETE LINEUP FIRST" : action}</b>
    </>
  );

  return disabled ? (
    <div className="game-mode game-mode--disabled">{content}</div>
  ) : (
    <Link className="game-mode" to={to}>
      {content}
    </Link>
  );
}

export default GamesPage;
