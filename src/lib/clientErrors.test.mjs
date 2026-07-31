import assert from "node:assert/strict";
import test from "node:test";
import { getUserFriendlyError } from "./clientErrors.js";

test("permission errors use product language", () => {
  assert.equal(getUserFriendlyError({ code: "firestore/permission-denied", message: "Missing or insufficient permissions." }), "You don't have permission to do that.");
});

test("network errors use a retryable connection message", () => {
  assert.equal(getUserFriendlyError({ code: "functions/unavailable" }), "Connection problem. Please try again.");
});

test("business errors remain specific", () => {
  assert.equal(getUserFriendlyError({ code: "failed-precondition", message: "That player has already been signed." }), "That player has already been signed.");
});

test("raw technical messages are not exposed", () => {
  assert.equal(getUserFriendlyError({ message: "Could not load Firestore team document." }, "Could not load your team."), "Could not load your team.");
});
