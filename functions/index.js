import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  buildOfficialCompletion,
  OFFICIAL_PRESENTATION_DURATION_MS,
  simulateOfficialGame,
} from "./lib/completeOfficialGame.js";
import {
  createSeasonProgress,
  isRoundCompleteAfterGame,
  nextRoundToStart,
  ROUND_STATUS,
} from "./shared/seasonProgress.js";
import { buildRegularSeasonFinalization } from "./shared/postseason.js";

if (!getApps().length) initializeApp();

const db = getFirestore();

export const startRegularSeasonRound = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { leagueId } = request.data || {};
  if (typeof leagueId !== "string") {
    throw new HttpsError("invalid-argument", "A league is required.");
  }
  const leagueRef = db.doc(`leagues/${leagueId}`);
  return db.runTransaction(async (transaction) => {
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
    const round = nextRoundToStart(progress);
    if (!round) {
      throw new HttpsError("failed-precondition", "The next round is not eligible yet.");
    }
    const gamesSnapshot = legacyGameDocs
      ? { docs: legacyGameDocs.filter((snapshot) => snapshot.data().round === round) }
      : await transaction.get(leagueRef.collection("games").where("round", "==", round));
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
    const now = Timestamp.now();
    games.forEach((game) => transaction.update(game.ref, {
      status: "in_progress",
      runtime: { version: 1 },
      startedAt: now,
      updatedAt: now,
    }));
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
    return { alreadyStarted: false, currentRound: round };
  });
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
    if (league.status !== "regular_season") {
      throw new HttpsError("failed-precondition", "The league is not in the regular season.");
    }
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

    const roundSnapshot = await transaction.get(
      leagueRef.collection("games").where("round", "==", game.round),
    );
    const progress = league.seasonProgress;
    const otherRoundGamesComplete = isRoundCompleteAfterGame(
      roundSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
      gameId,
    );
    const finalizingRegularSeason =
      progress?.roundStatus === ROUND_STATUS.ACTIVE &&
      progress.currentRound === game.round &&
      game.round === progress.totalRounds &&
      otherRoundGamesComplete;
    const allGamesSnapshot = finalizingRegularSeason
      ? await transaction.get(leagueRef.collection("games"))
      : null;
    const allTeamsSnapshot = finalizingRegularSeason
      ? await transaction.get(leagueRef.collection("teams"))
      : null;

    let simulation;
    try {
      simulation = simulateOfficialGame({
        gameIdentity: {
          leagueId,
          gameId,
          season: game.season,
          scheduleVersion: game.scheduleVersion,
          homeUid: game.homeUid,
          awayUid: game.awayUid,
        },
        homeTeam,
        awayTeam,
      });
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    const completion = buildOfficialCompletion({ game, homeTeam, awayTeam, simulation });
    const now = Timestamp.now();
    const completedProgress = finalizingRegularSeason ? {
      ...progress,
      roundStatus: ROUND_STATUS.COMPLETED,
      regularSeasonComplete: true,
      roundCompletedAt: now,
    } : null;
    const finalization = finalizingRegularSeason
      ? buildRegularSeasonFinalization({
          league: { ...league, seasonProgress: completedProgress },
          teams: allTeamsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
          games: allGamesSnapshot.docs.map((snapshot) => snapshot.id === gameId
            ? { id: snapshot.id, ...snapshot.data(), status: "completed", result: completion.result }
            : { id: snapshot.id, ...snapshot.data() }),
          completedAt: now,
        })
      : null;
    transaction.update(gameRef, {
      status: "completed",
      result: completion.result,
      boxScore: completion.boxScore,
      timeline: completion.timeline,
      presentation: {
        version: 1,
        speed: 1,
        durationMs: OFFICIAL_PRESENTATION_DURATION_MS,
        startedAt: now,
      },
      completedAt: now,
      updatedAt: now,
    });
    transaction.update(homeRef, { record: completion.homeRecord, updatedAt: now });
    transaction.update(awayRef, { record: completion.awayRecord, updatedAt: now });
    if (
      progress?.roundStatus === ROUND_STATUS.ACTIVE &&
      progress.currentRound === game.round &&
      otherRoundGamesComplete
    ) {
      const regularSeasonComplete = game.round === progress.totalRounds;
      transaction.update(leagueRef, {
        seasonProgress: completedProgress || {
          ...progress,
          roundStatus: ROUND_STATUS.COMPLETED,
          regularSeasonComplete,
          roundCompletedAt: now,
        },
        ...(finalization ? {
          regularSeasonResult: finalization.regularSeasonResult,
          postseason: finalization.postseason,
        } : {}),
        updatedAt: now,
      });
    }
    return {
      alreadyCompleted: false,
      result: completion.result,
      boxScore: completion.boxScore,
      timeline: completion.timeline,
    };
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
