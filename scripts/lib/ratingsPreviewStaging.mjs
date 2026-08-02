import { applicationDefault, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { stageRatingsPreview } from "../../functions/lib/generateRatingsPreview.js";
import {
  GOAT_IMPORT_ADAPTER_VERSION,
  GOAT_PROVIDER_SCHEMA_VERSION,
} from "../../functions/lib/goatRatingsImport.js";
import { RATING_FORMULA_VERSION, RATINGS_SOURCE_V2 } from "../../functions/shared/playerRatingsV2.js";

const VALUE_OPTIONS = new Set(["--season", "--output", "--input", "--admin-uid", "--category", "--max-players"]);
const BOOLEAN_OPTIONS = new Set(["--stage", "--confirm", "--dry-run"]);
const ADMIN_OPERATION_TIMEOUT_MS = 60_000;

function withAdminTimeout(promise, operation) {
  let timeout;
  const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(Object.assign(new Error(`${operation} timed out after ${ADMIN_OPERATION_TIMEOUT_MS}ms.`), { code: "deadline-exceeded" })), ADMIN_OPERATION_TIMEOUT_MS); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timeout));
}

export function parseRatingsCliOptions(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const equals = token.indexOf("=");
    const name = equals > 0 ? token.slice(0, equals) : token;
    if (BOOLEAN_OPTIONS.has(name)) {
      if (equals > 0) throw new Error(`${name} does not accept a value.`);
      options[name.slice(2).replaceAll("-", "_")] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new Error(`Unknown argument: ${token}`);
    const value = equals > 0 ? token.slice(equals + 1) : argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    options[name.slice(2).replaceAll("-", "_")] = value;
  }
  return options;
}

export function validateStageOptions(options) {
  if (!options.stage) return;
  if (!options.confirm) throw new Error("Staging requires --stage --confirm.");
  if (!options.admin_uid) throw new Error("Staging requires --admin-uid.");
  if (options.dry_run) throw new Error("--dry-run cannot be combined with --stage.");
}

export function reconcilePublicationBlockers(preview) {
  if (!preview?.manifest?.publication) return preview;
  return {
    ...preview,
    manifest: {
      ...preview.manifest,
      publication: {
        ...preview.manifest.publication,
        blockers: (preview.manifest.publication.blockers || []).filter((code) => code !== "publication-not-implemented"),
      },
    },
  };
}

export function validateGoatPreviewPayload(payload) {
  const preview = reconcilePublicationBlockers(payload?.preview ?? payload);
  const manifest = preview?.manifest;
  if (!manifest || !Array.isArray(preview?.players)) throw new Error("Input does not contain a valid Ratings preview.");
  if (!manifest.importId || !manifest.season) throw new Error("Preview manifest is missing importId or season.");
  if (manifest.provider !== RATINGS_SOURCE_V2) throw new Error(`Unsupported preview provider: ${manifest.provider || "missing"}.`);
  if (manifest.formulaVersion !== RATING_FORMULA_VERSION) throw new Error(`Unsupported ratings formula version: ${manifest.formulaVersion || "missing"}.`);
  const fetchManifest = manifest.fetchManifest;
  if (!fetchManifest || fetchManifest.providerSchemaVersion !== GOAT_PROVIDER_SCHEMA_VERSION || fetchManifest.adapterVersion !== GOAT_IMPORT_ADAPTER_VERSION) {
    throw new Error("Preview uses an unsupported or missing GOAT provider schema/adapter version.");
  }
  if (preview.players.length < 1 || preview.players.length > 700) throw new Error("Preview player count must be between 1 and 700.");
  const ids = preview.players.map((player) => String(player?.playerId || ""));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error("Preview player IDs must be present and unique.");
  if (manifest.publication?.enabled !== false) throw new Error("Only non-published previews can be staged.");
  if (manifest.licensingCheckpoint?.status !== "required") throw new Error("Preview licensing checkpoint is invalid for staging.");
  return preview;
}

export function isApplicationDefaultCredentialsError(error) {
  return /application default credentials|could not load the default credentials|unable to detect a project id|default credentials/i.test(String(error?.message || error));
}

export function applicationDefaultCredentialsMessage() {
  return "Application Default Credentials are required for staging.\n\nRun:\n\ngcloud auth application-default login";
}

export function stagingSuccessMessages(importId) {
  return [
    `Staged import ID: ${importId}`,
    "Firebase staging complete.",
    "No player catalog publication occurred; playerCatalogs/current was not changed.",
  ];
}

export async function createAdminStagingContext({ adminUid, authFactory = getAuth, firestoreFactory = getFirestore, logger = () => {} } = {}) {
  try {
    logger("Initializing Firebase Admin...");
    const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
    const auth = authFactory();
    logger("Verifying admin user...");
    let user;
    try { user = await withAdminTimeout(auth.getUser(adminUid), "Firebase admin user lookup"); }
    catch (error) {
      if (/user-not-found|no user record/i.test(String(error?.code || error?.message || error))) throw new Error("The supplied Firebase admin user could not be found.", { cause: error });
      throw error;
    }
    if (user.customClaims?.admin !== true) throw new Error("The supplied Firebase user does not have the admin custom claim.");
    return { db: firestoreFactory(), user, cleanup: () => withAdminTimeout(deleteApp(app), "Firebase Admin cleanup") };
  } catch (error) {
    if (isApplicationDefaultCredentialsError(error)) throw new Error(applicationDefaultCredentialsMessage(), { cause: error });
    throw error;
  }
}

export async function stageValidatedPreview({ preview, adminUid, contextFactory = createAdminStagingContext, stage = stageRatingsPreview, logger = () => {} } = {}) {
  const validated = validateGoatPreviewPayload({ preview });
  const context = await contextFactory({ adminUid, logger });
  try {
    const result = await stage({ db: context.db, auth: { uid: context.user.uid, token: context.user.customClaims }, preview: validated, logger });
    if (!result?.importId || result.published !== false) throw new Error("Firebase staging did not return a safe non-published result.");
    return result;
  } finally {
    if (context.cleanup) { logger("Closing Firebase Admin resources..."); await context.cleanup(); }
  }
}
