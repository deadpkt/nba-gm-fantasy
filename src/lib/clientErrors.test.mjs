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

test("Firebase Auth errors retain specific user-friendly meaning", () => {
  assert.equal(getUserFriendlyError({ code: "auth/invalid-credential", message: "Firebase: Error (auth/invalid-credential)." }), "Email or password is incorrect.");
  assert.equal(getUserFriendlyError({ code: "auth/email-already-in-use" }), "An account already exists for this email.");
  assert.equal(getUserFriendlyError({ code: "auth/weak-password" }), "Use a stronger password with at least 6 characters.");
  assert.equal(getUserFriendlyError({ code: "auth/too-many-requests" }), "Too many sign-in attempts. Please wait and try again.");
  assert.equal(getUserFriendlyError({ code: "auth/operation-not-allowed" }), "Email and password sign-in is not enabled.");
});
