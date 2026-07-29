import assert from "node:assert/strict";
import test from "node:test";
import {
  getOfficialParticipantSide,
  isLegalOfficialGameTransition,
  OFFICIAL_GAME_STATUS,
} from "./officialGameLifecycle.js";

test("official participant identity resolves only the authenticated scheduled side", () => {
  const game = { homeUid: "home-user", awayUid: "away-user" };
  assert.equal(getOfficialParticipantSide(game, "home-user"), "home");
  assert.equal(getOfficialParticipantSide(game, "away-user"), "away");
  assert.equal(getOfficialParticipantSide(game, "league-spectator"), null);
  assert.equal(getOfficialParticipantSide(game, null), null);
});

test("official lifecycle permits only forward state transitions", () => {
  const { SCHEDULED, READY, IN_PROGRESS, COMPLETED } = OFFICIAL_GAME_STATUS;
  assert.equal(isLegalOfficialGameTransition(SCHEDULED, IN_PROGRESS), true);
  assert.equal(isLegalOfficialGameTransition(READY, IN_PROGRESS), true);
  assert.equal(isLegalOfficialGameTransition(IN_PROGRESS, COMPLETED), true);

  for (const from of Object.values(OFFICIAL_GAME_STATUS)) {
    for (const to of Object.values(OFFICIAL_GAME_STATUS)) {
      if (
        [
          `${SCHEDULED}:${IN_PROGRESS}`,
          `${READY}:${IN_PROGRESS}`,
          `${IN_PROGRESS}:${COMPLETED}`,
        ].includes(`${from}:${to}`)
      ) {
        continue;
      }
      assert.equal(isLegalOfficialGameTransition(from, to), false);
    }
  }
});
