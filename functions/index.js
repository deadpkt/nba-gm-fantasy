import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { defineSecret } from "firebase-functions/params";
import {
  buildOfficialGameActivation,
  buildOfficialCompletion,
} from "./lib/completeOfficialGame.js";
import {
  createSeasonProgress,
  isGameProgressionComplete,
  isRoundProgressionComplete,
  nextRoundToStart,
  ROUND_STATUS,
} from "./shared/seasonProgress.js";
import { buildRegularSeasonFinalization } from "./shared/postseason.js";
import { buildChampionship, buildFinalMatchup, buildPlayoffInitialization } from "./shared/playoffs.js";
import { buildPresentationWindow, isPresentationDeadlineReached } from "./shared/presentationTiming.js";
import { buildOffseasonTransition, buildSeasonHistory, seasonHistoryMatches } from "./shared/seasonHistory.js";
import { buildNextSeasonTransition, isNextSeasonCommissioner, isNextSeasonTransitionRetry } from "./shared/nextSeason.js";
import { ageContractForSeason, initializeMissingContracts, validateTeamContracts } from "./shared/contracts.js";
import { syncNbaCatalog as runNbaCatalogSync } from "./lib/syncNbaCatalog.js";
import { normalizeRosterConfig } from "./shared/rosterConfig.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const balldontlieApiKey = defineSecret("BALLDONTLIE_API_KEY");

export const syncNbaPlayerCatalog = onCall({ secrets: [balldontlieApiKey], timeoutSeconds: 1800, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Catalog administrator access is required.");
  try { return await runNbaCatalogSync({ db, apiKey: balldontlieApiKey.value() }); }
  catch (error) { throw new HttpsError("internal", `NBA catalog sync failed: ${error.message}`); }
});

export const initializeLeagueContracts = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can initialize league contracts.");
    if (!["season_ready", "regular_season", "playoffs", "offseason"].includes(league.status)) throw new HttpsError("failed-precondition", "Complete the draft before initializing contracts.");
    const [teamsSnapshot, contractsSnapshot] = await Promise.all([
      transaction.get(leagueRef.collection("teams")),
      transaction.get(leagueRef.collection("contracts")),
    ]);
    const teams = teamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    const rosterSize = normalizeRosterConfig(league).rosterSize;
    if (teams.length !== league.memberIds?.length || teams.some((team) => !Array.isArray(team.roster) || team.roster.length !== rosterSize)) throw new HttpsError("failed-precondition", `Every franchise needs its drafted ${rosterSize}-player roster.`);
    let creates;
    try {
      creates = initializeMissingContracts({ league, teams, existingContracts: contractsSnapshot.docs.map((snapshot) => snapshot.data()) });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    const now = Timestamp.now();
    creates.forEach((contract) => transaction.create(leagueRef.collection("contracts").doc(String(contract.playerId)), { ...contract, createdAt: now, updatedAt: now }));
    if (league.contractVersion !== 1) transaction.update(leagueRef, { contractVersion: 1, contractsInitializedAt: now, updatedAt: now });
    return { initialized: creates.length, alreadyInitialized: creates.length === 0 && league.contractVersion === 1 };
  });
});

function buildStartedGame(game, homeTeam, awayTeam, startedAt, rosterSize = 5) {
  const window = buildPresentationWindow(startedAt.toMillis());
  return buildOfficialGameActivation({
    game,
    homeTeam,
    awayTeam,
    startedAt,
    endsAt: Timestamp.fromMillis(window.endsAtMs),
    rosterSize,
  });
}

async function enqueuePresentationFinalization(game) {
  const queue = getFunctions().taskQueue("finalizeOfficialGameTask");
  await queue.enqueue(
    { leagueId: game.leagueId, gameId: game.id },
    { scheduleTime: game.endsAt.toDate() },
  );
}

export const scheduleOfficialGameFinalization = onDocumentUpdated(
  "leagues/{leagueId}/games/{gameId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.status === "in_progress" || after?.status !== "in_progress" || !after.presentation?.endsAt) return;
    await enqueuePresentationFinalization({ leagueId: event.params.leagueId, id: event.params.gameId, endsAt: after.presentation.endsAt });
  },
);

export const initializePlayoffs = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leagueRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...snapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can initialize playoffs.");
    let initialization;
    try { initialization = buildPlayoffInitialization(league); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
    if (initialization.alreadyInitialized) return initialization;
    const now = Timestamp.now();
    initialization.games.forEach((game) => transaction.create(leagueRef.collection("games").doc(game.id), { ...game, createdAt: now, updatedAt: now }));
    transaction.update(leagueRef, { status: "playoffs", postseason: { ...initialization.postseason, initializedAt: now }, updatedAt: now });
    return { ...initialization, games: initialization.games.map((game) => game.id) };
  });
});

export const startPlayoffRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const started = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leagueRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = snapshot.data();
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can start playoff rounds.");
    if (league.status !== "playoffs" || !["semifinals", "finals"].includes(league.postseason?.status)) throw new HttpsError("failed-precondition", "No playoff round is eligible.");
    const ids = league.postseason.status === "semifinals" ? league.postseason.games.semifinals : [league.postseason.games.final];
    const gameSnapshots = await Promise.all(ids.map((id) => transaction.get(leagueRef.collection("games").doc(id))));
    if (gameSnapshots.some((game) => !game.exists || game.data().status !== "scheduled")) throw new HttpsError("failed-precondition", "This playoff round has already started or is incomplete.");
    const teamIds = [...new Set(gameSnapshots.flatMap((game) => [game.data().homeUid, game.data().awayUid]))];
    const teamSnapshots = await Promise.all(teamIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))));
    if (teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Every playoff franchise must exist.");
    const teams = new Map(teamSnapshots.map((team) => [team.id, team.data()]));
    const now = Timestamp.now();
    const tasks = gameSnapshots.map((snapshot) => {
      const game = { id: snapshot.id, ...snapshot.data() };
      let update;
      try { update = buildStartedGame(game, teams.get(game.homeUid), teams.get(game.awayUid), now, normalizeRosterConfig(league).rosterSize); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      transaction.update(snapshot.ref, update);
      return { leagueId, id: game.id, endsAt: update.presentation.endsAt };
    });
    transaction.update(leagueRef, { postseason: { ...league.postseason, roundStartedAt: now }, updatedAt: now });
    return { status: league.postseason.status, games: ids, tasks };
  });
  return { status: started.status, games: started.games };
});

export const startRegularSeasonRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") {
    throw new HttpsError("invalid-argument", "A league is required.");
  }
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const started = await db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    if (league.commissionerUid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the commissioner can start a round.");
    }
    if (league.status !== "regular_season") {
      throw new HttpsError("failed-precondition", "The regular season is not active.");
    }
    let progress = league.seasonProgress;
    let legacyGameDocs = null;
    if (!progress) {
      const allGamesSnapshot = await transaction.get(leagueRef.collection("games"));
      legacyGameDocs = allGamesSnapshot.docs;
      const totalRounds = league.schedule?.totalRounds;
      if (!Number.isInteger(totalRounds) || totalRounds < 1) {
        throw new HttpsError("failed-precondition", "This season has invalid schedule metadata.");
      }
      const firstIncompleteRound = Array.from({ length: totalRounds }, (_, index) => index + 1)
        .find((roundNumber) => legacyGameDocs.some(
          (snapshot) => snapshot.data().round === roundNumber && snapshot.data().status !== "completed",
        ));
      if (!firstIncompleteRound) {
        const now = Timestamp.now();
        transaction.update(leagueRef, {
          seasonProgress: {
            ...createSeasonProgress(totalRounds),
            currentRound: totalRounds,
            roundStatus: ROUND_STATUS.COMPLETED,
            regularSeasonComplete: true,
          },
          updatedAt: now,
        });
        return { alreadyStarted: true, currentRound: totalRounds, regularSeasonComplete: true };
      }
      const currentGames = legacyGameDocs.filter(
        (snapshot) => snapshot.data().round === firstIncompleteRound,
      );
      if (currentGames.some((snapshot) => snapshot.data().status === "in_progress")) {
        const now = Timestamp.now();
        transaction.update(leagueRef, {
          seasonProgress: {
            ...createSeasonProgress(totalRounds),
            currentRound: firstIncompleteRound,
            roundStatus: ROUND_STATUS.ACTIVE,
            roundStartedAt: now,
          },
          updatedAt: now,
        });
        return { alreadyStarted: true, currentRound: firstIncompleteRound };
      }
      progress = {
        ...createSeasonProgress(totalRounds),
        currentRound: firstIncompleteRound,
      };
    }
    if (progress.roundStatus === ROUND_STATUS.ACTIVE) {
      return { alreadyStarted: true, currentRound: progress.currentRound };
    }
    if (progress.roundStatus === ROUND_STATUS.COMPLETED && progress.currentRound > 0) {
      const previousRoundSnapshot = legacyGameDocs
        ? { docs: legacyGameDocs.filter((snapshot) => snapshot.data().round === progress.currentRound) }
        : { docs: (await transaction.get(leagueRef.collection("games").where("season", "==", league.season))).docs.filter((snapshot) => snapshot.data().round === progress.currentRound) };
      if (!isRoundProgressionComplete(previousRoundSnapshot.docs.map((snapshot) => snapshot.data()))) {
        throw new HttpsError("failed-precondition", "Waiting for every live game presentation to finish.");
      }
    }
    const round = nextRoundToStart(progress);
    if (!round) {
      throw new HttpsError("failed-precondition", "The next round is not eligible yet.");
    }
    const gamesSnapshot = legacyGameDocs
      ? { docs: legacyGameDocs.filter((snapshot) => snapshot.data().round === round) }
      : { docs: (await transaction.get(leagueRef.collection("games").where("season", "==", league.season))).docs.filter((snapshot) => snapshot.data().round === round) };
    const expectedGames = league.memberIds.length / 2;
    if (gamesSnapshot.docs.length !== expectedGames) {
      throw new HttpsError("failed-precondition", "The current round schedule is incomplete.");
    }
    const games = gamesSnapshot.docs.map((snapshot) => ({ ref: snapshot.ref, ...snapshot.data() }));
    if (games.some((game) => !["scheduled", "ready"].includes(game.status))) {
      throw new HttpsError("failed-precondition", "Every game in this round must still be scheduled.");
    }
    if (games.some((game) => game.leagueId !== leagueId || game.season !== league.season || game.round !== round)) {
      throw new HttpsError("failed-precondition", "A scheduled game identity is invalid.");
    }
    const teamIds = [...new Set(games.flatMap((game) => [game.homeUid, game.awayUid]))];
    const teamSnapshots = await Promise.all(teamIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))));
    if (teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Every scheduled franchise must exist.");
    const teams = new Map(teamSnapshots.map((team) => [team.id, team.data()]));
    const now = Timestamp.now();
    const tasks = games.map((game) => {
      let update;
      try { update = buildStartedGame({ ...game, id: game.ref.id }, teams.get(game.homeUid), teams.get(game.awayUid), now, normalizeRosterConfig(league).rosterSize); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      transaction.update(game.ref, update);
      return { leagueId, id: game.ref.id, endsAt: update.presentation.endsAt };
    });
    transaction.update(leagueRef, {
      seasonProgress: {
        ...progress,
        currentRound: round,
        roundStatus: ROUND_STATUS.ACTIVE,
        regularSeasonComplete: false,
        roundStartedAt: now,
      },
      updatedAt: now,
    });
    return { alreadyStarted: false, currentRound: round, tasks };
  });
  return { alreadyStarted: started.alreadyStarted, currentRound: started.currentRound, regularSeasonComplete: started.regularSeasonComplete };
});

export const completeOfficialGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId, gameId } = request.data || {};
  if (typeof leagueId !== "string" || typeof gameId !== "string") {
    throw new HttpsError("invalid-argument", "A league and game are required.");
  }

  const leagueRef = db.doc(`leagues/${leagueId}`);
  const gameRef = leagueRef.collection("games").doc(gameId);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    const gameSnapshot = await transaction.get(gameRef);
    if (!leagueSnapshot.exists || !gameSnapshot.exists) {
      throw new HttpsError("not-found", "This official game is unavailable.");
    }

    const league = leagueSnapshot.data();
    const game = gameSnapshot.data();
    if (![game.homeUid, game.awayUid].includes(request.auth.uid)) {
      throw new HttpsError("permission-denied", "Only scheduled participants can run this game.");
    }
    const isPlayoffGame = game.stage === "semifinal" || game.stage === "final";
    if ((!isPlayoffGame && league.status !== "regular_season") || (isPlayoffGame && league.status !== "playoffs")) throw new HttpsError("failed-precondition", "This official game is not active in the current league phase.");
    if (game.leagueId !== leagueId || game.season !== league.season) {
      throw new HttpsError("failed-precondition", "The scheduled game identity is invalid.");
    }

    const homeRef = leagueRef.collection("teams").doc(game.homeUid);
    const awayRef = leagueRef.collection("teams").doc(game.awayUid);
    const [homeSnapshot, awaySnapshot] = await Promise.all([
      transaction.get(homeRef),
      transaction.get(awayRef),
    ]);
    if (!homeSnapshot.exists || !awaySnapshot.exists) {
      throw new HttpsError("failed-precondition", "Both scheduled franchises must exist.");
    }
    const homeTeam = homeSnapshot.data();
    const awayTeam = awaySnapshot.data();
    if (homeTeam.ownerUid !== game.homeUid || awayTeam.ownerUid !== game.awayUid) {
      throw new HttpsError("failed-precondition", "Scheduled participants no longer match their franchises.");
    }

    if (game.status === "completed") {
      return {
        alreadyCompleted: true,
        result: game.result,
        boxScore: game.boxScore,
        timeline: game.timeline,
        presentation: game.presentation,
      };
    }
    if (game.status !== "in_progress") {
      throw new HttpsError("failed-precondition", "Start this official game before simulating it.");
    }
    if (game.timeline?.length && game.result && game.presentation) {
      return { alreadyGenerated: true, result: game.result, boxScore: game.boxScore, timeline: game.timeline, presentation: game.presentation };
    }
    throw new HttpsError("failed-precondition", "This game was not initialized by its trusted round start.");
  });
});

async function finalizePresentation({ leagueId, gameId, participantUid = null }) {
  if (typeof leagueId !== "string" || typeof gameId !== "string") throw new HttpsError("invalid-argument", "A league and game are required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  const gameRef = leagueRef.collection("games").doc(gameId);
  return db.runTransaction(async (transaction) => {
    const [leagueSnapshot, gameSnapshot] = await Promise.all([transaction.get(leagueRef), transaction.get(gameRef)]);
    if (!leagueSnapshot.exists || !gameSnapshot.exists) throw new HttpsError("not-found", "This official game is unavailable.");
    const league = leagueSnapshot.data();
    const game = gameSnapshot.data();
    if (participantUid && ![game.homeUid, game.awayUid].includes(participantUid)) throw new HttpsError("permission-denied", "Only scheduled participants can finalize this presentation.");
    const isPlayoffGame = ["semifinal", "final"].includes(game.stage);
    if ((!isPlayoffGame && league.status !== "regular_season") || (isPlayoffGame && league.status !== "playoffs")) throw new HttpsError("failed-precondition", "This official game is not active in the current league phase.");
    if (game.leagueId !== leagueId || game.season !== league.season) throw new HttpsError("failed-precondition", "The scheduled game identity is invalid.");
    if (game.status === "completed") return { alreadyCompleted: true };
    if (game.status !== "in_progress" || !game.result || !game.timeline?.length || !game.presentation?.endsAt) throw new HttpsError("failed-precondition", "The trusted presentation is not ready to finalize.");
    const now = Timestamp.now();
    if (!isPresentationDeadlineReached(game.presentation, now.toMillis())) throw new HttpsError("failed-precondition", "The live presentation is still in progress.");
    const homeRef = leagueRef.collection("teams").doc(game.homeUid);
    const awayRef = leagueRef.collection("teams").doc(game.awayUid);
    const [homeSnapshot, awaySnapshot] = await Promise.all([transaction.get(homeRef), transaction.get(awayRef)]);
    if (!homeSnapshot.exists || !awaySnapshot.exists) throw new HttpsError("failed-precondition", "Both franchises must exist.");
    const seasonGamesSnapshot = (!isPlayoffGame || game.stage === "semifinal") ? await transaction.get(leagueRef.collection("games").where("season", "==", league.season)) : null;
    const roundSnapshot = isPlayoffGame ? null : { docs: seasonGamesSnapshot.docs.filter((snapshot) => snapshot.data().round === game.round) };
    const semifinalSnapshot = game.stage === "semifinal" ? { docs: seasonGamesSnapshot.docs.filter((snapshot) => snapshot.data().stage === "semifinal") } : null;
    const projectedGame = { id: gameId, ...game, status: "completed", presentationCompletedAt: now };
    const progress = league.seasonProgress;
    const roundComplete = !isPlayoffGame && isRoundProgressionComplete(roundSnapshot.docs.map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() }));
    const finalSeasonGame = roundComplete && game.round === progress?.totalRounds;
    const allGamesSnapshot = finalSeasonGame ? await transaction.get(leagueRef.collection("games")) : null;
    const allTeamsSnapshot = finalSeasonGame ? await transaction.get(leagueRef.collection("teams")) : null;
    transaction.update(gameRef, { status: "completed", presentationCompletedAt: now, completedAt: now, updatedAt: now });
    if (!isPlayoffGame) {
      const records = buildOfficialCompletion({ game, homeTeam: homeSnapshot.data(), awayTeam: awaySnapshot.data(), simulation: { result: game.result, boxScore: game.boxScore, timeline: game.timeline } });
      transaction.update(homeRef, { record: records.homeRecord, updatedAt: now });
      transaction.update(awayRef, { record: records.awayRecord, updatedAt: now });
      if (roundComplete) {
        const completedProgress = { ...progress, roundStatus: ROUND_STATUS.COMPLETED, regularSeasonComplete: finalSeasonGame, roundCompletedAt: now };
        const finalization = finalSeasonGame ? buildRegularSeasonFinalization({
          league: { ...league, seasonProgress: completedProgress },
          teams: allTeamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
          games: allGamesSnapshot.docs.map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() }),
          completedAt: now,
        }) : null;
        transaction.update(leagueRef, { seasonProgress: completedProgress, ...(finalization ? { regularSeasonResult: finalization.regularSeasonResult, postseason: finalization.postseason } : {}), updatedAt: now });
      }
    } else if (game.stage === "semifinal") {
      const semifinals = semifinalSnapshot.docs.filter((snapshot) => snapshot.data().season === league.season).map((snapshot) => snapshot.id === gameId ? projectedGame : { id: snapshot.id, ...snapshot.data() });
      if (semifinals.length === 2 && semifinals.every(isGameProgressionComplete)) {
        const finalGame = buildFinalMatchup({ id: leagueId, ...league }, semifinals);
        transaction.create(leagueRef.collection("games").doc(finalGame.id), { ...finalGame, createdAt: now, updatedAt: now });
        transaction.update(leagueRef, { postseason: { ...league.postseason, status: "finals", games: { ...league.postseason.games, final: finalGame.id }, semifinalsCompletedAt: now }, updatedAt: now });
      }
    } else {
      const championship = buildChampionship(league.postseason, projectedGame, now);
      transaction.update(leagueRef, { postseason: championship.postseason, updatedAt: now });
    }
    return { alreadyCompleted: false, completedAt: now };
  });
}

export const finalizeOfficialGamePresentation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return finalizePresentation({ ...(request.data || {}), participantUid: request.auth.uid });
});

export const finalizeOfficialGameTask = onTaskDispatched(
  { retryConfig: { maxAttempts: 5, minBackoffSeconds: 5 } },
  async (request) => {
    await finalizePresentation(request.data || {});
  },
);

export const enterOffseason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (league.commissionerUid !== request.auth.uid) throw new HttpsError("permission-denied", "Only the commissioner can enter offseason.");
    if (!["playoffs", "offseason"].includes(league.status)) throw new HttpsError("failed-precondition", "The league is not ready for offseason.");
    if (!Number.isInteger(league.season) || league.season < 1) throw new HttpsError("failed-precondition", "The active season number is invalid.");
    const historyRef = leagueRef.collection("seasons").doc(String(league.season));
    const playoffIds = [...(league.postseason?.games?.semifinals || []), league.postseason?.games?.final].filter(Boolean);
    const readPromises = [
      transaction.get(historyRef),
      ...playoffIds.map((id) => transaction.get(leagueRef.collection("games").doc(id))),
    ];
    if (league.contractVersion === 1) readPromises.push(transaction.get(leagueRef.collection("contracts")));
    const readSnapshots = await Promise.all(readPromises);
    const historySnapshot = readSnapshots[0];
    const gameSnapshots = readSnapshots.slice(1, 1 + playoffIds.length);
    const contractsSnapshot = league.contractVersion === 1 ? readSnapshots.at(-1) : null;
    if (!playoffIds.length || gameSnapshots.some((snapshot) => !snapshot.exists)) throw new HttpsError("failed-precondition", "The trusted playoff bracket is incomplete.");
    let history;
    try {
      history = buildSeasonHistory({
        league: { ...league, status: "playoffs" },
        playoffGames: gameSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    if (historySnapshot.exists && !seasonHistoryMatches(historySnapshot.data(), history)) throw new HttpsError("already-exists", "A conflicting completed season history already exists.");
    if (league.status === "offseason") return { alreadyFinalized: true, season: league.season };
    const now = Timestamp.now();
    if (!historySnapshot.exists) transaction.create(historyRef, { ...history, createdAt: now });
    if (contractsSnapshot) contractsSnapshot.docs.forEach((snapshot) => {
      let aged;
      try { aged = ageContractForSeason(snapshot.data(), league.season); } catch (error) { throw new HttpsError("failed-precondition", error.message); }
      if (aged !== snapshot.data() && aged.lastAgedSeason !== snapshot.data().lastAgedSeason) transaction.update(snapshot.ref, { yearsRemaining: aged.yearsRemaining, lastAgedSeason: aged.lastAgedSeason, updatedAt: now });
    });
    transaction.update(leagueRef, buildOffseasonTransition(league, now));
    return { alreadyFinalized: historySnapshot.exists, season: league.season };
  });
});

export const startNextSeason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = { id: leagueId, ...leagueSnapshot.data() };
    if (!isNextSeasonCommissioner(league, request.auth.uid)) throw new HttpsError("permission-denied", "Only the commissioner can start the next season.");
    if (isNextSeasonTransitionRetry(league)) return { alreadyStarted: true, season: league.season };
    if (league.status !== "offseason") throw new HttpsError("failed-precondition", "The league is not in offseason.");
    const historyRef = leagueRef.collection("seasons").doc(String(league.season));
    const nextSeasonReads = [
      transaction.get(historyRef),
      ...league.memberIds.map((uid) => transaction.get(leagueRef.collection("teams").doc(uid))),
    ];
    if (league.contractVersion === 1) nextSeasonReads.push(transaction.get(leagueRef.collection("contracts")));
    const nextSeasonSnapshots = await Promise.all(nextSeasonReads);
    const historySnapshot = nextSeasonSnapshots[0];
    const teamSnapshots = nextSeasonSnapshots.slice(1, 1 + league.memberIds.length);
    const contractsSnapshot = league.contractVersion === 1 ? nextSeasonSnapshots.at(-1) : null;
    if (!historySnapshot.exists || teamSnapshots.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "Completed history and every franchise are required.");
    if (contractsSnapshot) {
      const contracts = contractsSnapshot.docs.map((snapshot) => snapshot.data());
      const invalidTeam = teamSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })).find((team) => !validateTeamContracts(team, contracts, league).valid);
      if (invalidTeam) throw new HttpsError("failed-precondition", "Every franchise must have valid contracts and remain under the salary cap.");
    }
    const now = Timestamp.now();
    let transition;
    try {
      transition = buildNextSeasonTransition({
        league,
        history: historySnapshot.data(),
        teams: teamSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        transitionedAt: now,
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    const leagueUpdate = { ...transition.leagueUpdate };
    transition.fieldsToClear.forEach((field) => { leagueUpdate[field] = FieldValue.delete(); });
    transaction.update(leagueRef, leagueUpdate);
    transition.teamUpdates.forEach((team) => transaction.update(leagueRef.collection("teams").doc(team.uid), { record: team.record, updatedAt: now }));
    return { alreadyStarted: false, season: transition.targetSeason };
  });
});

export const finalizeRegularSeason = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") throw new HttpsError("invalid-argument", "A league is required.");
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
    const leagueSnapshot = await transaction.get(leagueRef);
    if (!leagueSnapshot.exists) throw new HttpsError("not-found", "This league is unavailable.");
    const league = leagueSnapshot.data();
    if (!league.memberIds?.includes(request.auth.uid)) {
      throw new HttpsError("permission-denied", "League membership is required.");
    }
    if (league.regularSeasonResult) {
      return { alreadyFinalized: true, regularSeasonResult: league.regularSeasonResult, postseason: league.postseason };
    }
    const [gamesSnapshot, teamsSnapshot] = await Promise.all([
      transaction.get(leagueRef.collection("games")),
      transaction.get(leagueRef.collection("teams")),
    ]);
    const now = Timestamp.now();
    let finalization;
    try {
      finalization = buildRegularSeasonFinalization({
        league,
        teams: teamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        games: gamesSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        completedAt: now,
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    transaction.update(leagueRef, {
      regularSeasonResult: finalization.regularSeasonResult,
      postseason: finalization.postseason,
      updatedAt: now,
    });
    return finalization;
  });
});
