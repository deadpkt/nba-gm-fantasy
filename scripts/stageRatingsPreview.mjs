import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseRatingsCliOptions,
  stagingSuccessMessages,
  stageValidatedPreview,
  validateGoatPreviewPayload,
} from "./lib/ratingsPreviewStaging.mjs";

export async function runStageRatingsPreview({
  argv = process.argv.slice(2),
  readPreviewFile = (input) => readFile(input, "utf8"),
  validatePreview = validateGoatPreviewPayload,
  stagePreview = stageValidatedPreview,
  logger = console.log,
} = {}) {
  const options = parseRatingsCliOptions(argv);
  if (!options.input) throw new Error("Provide --input <preview-file>.");
  if (!options.confirm) throw new Error("Staging requires --confirm.");
  if (!options.admin_uid) throw new Error("Staging requires --admin-uid.");
  if (options.stage) throw new Error("The stage-from-file command does not require --stage; use --confirm.");
  if (options.dry_run) throw new Error("--dry-run cannot be combined with staging.");

  logger("Mode: stage from file");
  logger(`Input: ${options.input}`);
  logger("Admin UID supplied: yes");
  logger("Provider fetch: disabled");
  logger("Loading preview file...");
  const payload = JSON.parse(await readPreviewFile(options.input));
  logger("Validating preview...");
  const preview = validatePreview(payload);
  const result = await stagePreview({ preview, adminUid: options.admin_uid, logger });
  stagingSuccessMessages(result.importId).forEach((message) => logger(message));
  return result;
}

export function reportStageRatingsPreviewError(error, errorLogger = console.error) {
  if (error.importId) {
    errorLogger(`Staging failed after ${error.writtenPlayerCount || 0}/${error.expectedPlayerCount || 0} players.`);
    errorLogger("Import remains non-ready.");
    errorLogger(`Import ID: ${error.importId}`);
  }
  errorLogger(`Ratings preview staging failed: ${error.message || "Unknown staging error."}`);
}

export async function executeStageRatingsPreview(options = {}) {
  try {
    await runStageRatingsPreview(options);
    return 0;
  } catch (error) {
    reportStageRatingsPreviewError(error, options.errorLogger);
    return 1;
  }
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) process.exitCode = await executeStageRatingsPreview();
