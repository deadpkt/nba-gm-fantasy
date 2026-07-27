import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function saveMatchHistory({
  userId,
  leagueId,
  matchId,
  matchDate,
  result,
  team,
  opponent,
  won,
}) {
  if (!leagueId) {
    throw new Error("A league is required to save a match result.");
  }

  const historyRef = doc(db, "users", userId, "matchHistory", matchId);
  const leagueTeamRef = doc(db, "leagues", leagueId, "teams", userId);

  await runTransaction(db, async (transaction) => {
    const historySnapshot = await transaction.get(historyRef);
    if (historySnapshot.exists()) return;

    const leagueTeamSnapshot = await transaction.get(leagueTeamRef);
    if (!leagueTeamSnapshot.exists()) {
      throw new Error("Your league franchise could not be found.");
    }

    const savedRecord = leagueTeamSnapshot.data().record;
    const record = {
      wins: Number.isFinite(savedRecord?.wins) ? savedRecord.wins : 0,
      losses: Number.isFinite(savedRecord?.losses) ? savedRecord.losses : 0,
    };
    const nextRecord = won
      ? { ...record, wins: record.wins + 1 }
      : { ...record, losses: record.losses + 1 };

    transaction.set(
      leagueTeamRef,
      { record: nextRecord, updatedAt: serverTimestamp() },
      { merge: true },
    );
    transaction.set(historyRef, {
      matchId,
      matchDate: matchDate || serverTimestamp(),
      result,
      team,
      opponent,
      won,
      createdAt: serverTimestamp(),
    });
  });
}

export async function saveExhibitionResult({
  user,
  leagueId,
  roster,
  lineup,
  opponent,
  game,
}) {
  const matchId = `exhibition-${crypto.randomUUID()}`;
  const home = {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Your Team",
    players: roster,
    lineup,
  };
  const away = {
    uid: "court-kings-ai",
    name: "Court Kings",
    players: opponent,
    lineup: {},
  };
  const result = {
    winner: game.homeWon
      ? { uid: home.uid, name: home.name }
      : { uid: away.uid, name: away.name },
    loser: game.homeWon
      ? { uid: away.uid, name: away.name }
      : { uid: home.uid, name: home.name },
    finalScore: { home: game.home.score, away: game.away.score },
    mvp: game.mvp,
    playerStatistics: { home: {}, away: {} },
    teamStatistics: { home: game.home, away: game.away },
    lineups: { home, away },
  };

  await saveMatchHistory({
    userId: user.uid,
    leagueId,
    matchId,
    result,
    team: home,
    opponent: away,
    won: game.homeWon,
  });
}
