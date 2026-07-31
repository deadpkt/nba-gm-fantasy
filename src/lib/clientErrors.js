const TECHNICAL_MESSAGE = /firebase|firestore|cloud function|callable|admin sdk|permission[- ]denied|missing or insufficient permissions|rpc|transaction|document|collection|snapshot|database path/i;

const CODE_MESSAGES = Object.freeze({
  "permission-denied": "You don't have permission to do that.",
  unauthenticated: "Please sign in and try again.",
  "network-request-failed": "Connection problem. Please try again.",
  unavailable: "Connection problem. Please try again.",
  "deadline-exceeded": "The request took too long. Please try again.",
  "already-exists": "That action is no longer available. Refresh and try again.",
  aborted: "That action is no longer available. Refresh and try again.",
  conflict: "That action is no longer available. Refresh and try again.",
});

function normalizeCode(code) {
  return String(code || "").toLowerCase().split("/").pop();
}

export function getUserFriendlyError(error, fallback = "Something went wrong. Please try again.") {
  const code = normalizeCode(error?.code);
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (code === "not-found") return fallback || "That item is no longer available.";

  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (!message || TECHNICAL_MESSAGE.test(message)) return fallback;
  return message.replace(/^Firebase:\s*/i, "");
}

export function reportClientError(scope, error) {
  if (!import.meta.env?.DEV) return;
  console.error(`[${scope}]`, {
    code: error?.code || "unknown",
    message: error?.message || "Unknown error",
  });
}

export function devDiagnostic(scope, message, details) {
  if (!import.meta.env?.DEV) return;
  console.debug(`[${scope}] ${message}`, details);
}
