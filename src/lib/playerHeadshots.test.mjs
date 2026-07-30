import assert from "node:assert/strict";
import test from "node:test";
import { handleBrokenPlayerHeadshot, PLAYER_HEADSHOT_PLACEHOLDER, resolvePlayerHeadshot } from "./playerHeadshots.js";

test("missing player image resolves to the shared placeholder", () => {
  assert.equal(resolvePlayerHeadshot({ id: "bdl_1", source: { provider: "balldontlie", externalId: 201939 } }), PLAYER_HEADSHOT_PLACEHOLDER);
});

test("only a verified NBA ID constructs an NBA CDN headshot", () => {
  assert.equal(resolvePlayerHeadshot({ id: "bdl_115", nbaPlayerId: "201939" }), "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png");
});

test("broken external image falls back once without an error loop", () => {
  const image = { src: "https://example.invalid/player.png", onerror: () => {} };
  handleBrokenPlayerHeadshot({ currentTarget: image });
  assert.equal(image.src, PLAYER_HEADSHOT_PLACEHOLDER);
  assert.equal(image.onerror, null);
  assert.doesNotThrow(() => handleBrokenPlayerHeadshot({ currentTarget: image }));
});

test("cached storage image has priority over canonical and legacy URLs", () => {
  assert.equal(resolvePlayerHeadshot({ headshot: { storageUrl: "storage.png" }, imageUrl: "canonical.png", image: "legacy.png" }), "storage.png");
});
