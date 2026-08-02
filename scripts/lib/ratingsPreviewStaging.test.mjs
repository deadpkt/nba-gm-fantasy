import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GOAT_IMPORT_ADAPTER_VERSION, GOAT_PROVIDER_SCHEMA_VERSION } from "../../functions/lib/goatRatingsImport.js";
import { RATING_FORMULA_VERSION, RATINGS_SOURCE_V2 } from "../../functions/shared/playerRatingsV2.js";
import {
  applicationDefaultCredentialsMessage,
  isApplicationDefaultCredentialsError,
  parseRatingsCliOptions,
  reconcilePublicationBlockers,
  stageValidatedPreview,
  stagingSuccessMessages,
  validateGoatPreviewPayload,
  validateStageOptions,
} from "./ratingsPreviewStaging.mjs";
import { executeStageRatingsPreview, runStageRatingsPreview } from "../stageRatingsPreview.mjs";

function preview() {
  return {
    manifest: {
      importId: "ratings_2025_fixture",
      provider: RATINGS_SOURCE_V2,
      season: "2025",
      formulaVersion: RATING_FORMULA_VERSION,
      licensingCheckpoint: { status: "required" },
      publication: { enabled: false, target: null, blockers: ["publication-not-implemented", "licensing-checkpoint-required"] },
      fetchManifest: {
        providerSchemaVersion: GOAT_PROVIDER_SCHEMA_VERSION,
        adapterVersion: GOAT_IMPORT_ADAPTER_VERSION,
      },
    },
    players: [{ playerId: "bdl_1", overall: 80 }],
  };
}

test("stage flags parse in split and equals forms", () => {
  assert.deepEqual(parseRatingsCliOptions(["--season", "2025", "--stage", "--confirm", "--admin-uid=uid-1"]), {
    season: "2025", stage: true, confirm: true, admin_uid: "uid-1",
  });
});

test("stage validation rejects missing confirmation", () => {
  assert.throws(() => validateStageOptions({ stage: true, admin_uid: "uid" }), /--stage --confirm/);
});

test("stage validation rejects missing admin UID", () => {
  assert.throws(() => validateStageOptions({ stage: true, confirm: true }), /--admin-uid/);
});

test("invalid admin claim fails before staging", async () => {
  await assert.rejects(() => stageValidatedPreview({
    preview: preview(), adminUid: "member",
    contextFactory: async () => { throw new Error("The supplied Firebase user does not have the admin custom claim."); },
    stage: async () => { throw new Error("must not run"); },
  }), /admin custom claim/);
});

test("successful staging returns and preserves the import ID", async () => {
  let staged = 0; let cleaned = 0;
  const result = await stageValidatedPreview({
    preview: preview(), adminUid: "admin",
    contextFactory: async () => ({ db: {}, user: { uid: "admin", customClaims: { admin: true } }, cleanup: async () => { cleaned += 1; } }),
    stage: async ({ auth, preview: value }) => {
      staged += 1;
      assert.equal(auth.token.admin, true);
      assert.equal(value.manifest.importId, "ratings_2025_fixture");
      return { importId: value.manifest.importId, playerCount: 1, published: false };
    },
  });
  assert.equal(staged, 1);
  assert.equal(cleaned, 1);
  assert.equal(result.importId, "ratings_2025_fixture");
  assert.deepEqual(stagingSuccessMessages(result.importId), [
    "Staged import ID: ratings_2025_fixture",
    "Firebase staging complete.",
    "No player catalog publication occurred; playerCatalogs/current was not changed.",
  ]);
});

test("Firebase resources are cleaned up when staging fails", async () => {
  let cleaned = 0;
  await assert.rejects(() => stageValidatedPreview({
    preview: preview(), adminUid: "admin",
    contextFactory: async () => ({ db: {}, user: { uid: "admin", customClaims: { admin: true } }, cleanup: async () => { cleaned += 1; } }),
    stage: async () => { throw new Error("write failed"); },
  }), /write failed/);
  assert.equal(cleaned, 1);
});

test("local-only options do not activate staging", () => {
  const options = parseRatingsCliOptions(["--season", "2025", "--output", "preview.json"]);
  assert.equal(options.stage, undefined);
  assert.doesNotThrow(() => validateStageOptions(options));
});

test("stage-from-file has no provider or publication dependency", async () => {
  const source = await readFile(new URL("../stageRatingsPreview.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetchGoatRatingsPreview|createBalldontlieClient|publishCatalogVersion|catalogPublication/);
  assert.match(source, /stageValidatedPreview/);
});

test("stale publication blocker is removed while licensing remains", () => {
  const reconciled = reconcilePublicationBlockers(preview());
  assert.deepEqual(reconciled.manifest.publication.blockers, ["licensing-checkpoint-required"]);
  assert.equal(reconciled.manifest.publication.enabled, false);
});

test("unsupported preview versions are rejected", () => {
  const value = preview(); value.manifest.formulaVersion = "ratings-v999";
  assert.throws(() => validateGoatPreviewPayload(value), /unsupported ratings formula/i);
});

test("ADC failures produce actionable non-secret guidance", () => {
  assert.equal(isApplicationDefaultCredentialsError(new Error("Unable to detect a Project Id in the current environment.")), true);
  assert.match(applicationDefaultCredentialsMessage(), /gcloud auth application-default login/);
});

const stageArguments = ["--input", "preview.json", "--confirm", "--admin-uid", "admin"];

test("CLI awaits the complete asynchronous staging flow before success", async () => {
  const logs = []; let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const running = runStageRatingsPreview({
    argv: stageArguments,
    readPreviewFile: async () => JSON.stringify({ preview: preview() }),
    stagePreview: async ({ logger }) => { logger("Preparing import fixture..."); await gate; return { importId: "ratings_2025_fixture", published: false }; },
    logger: (line) => logs.push(line),
  });
  await Promise.resolve();
  assert.equal(logs.some((line) => line.startsWith("Staged import ID:")), false);
  release(); await running;
  assert.ok(logs.includes("Staged import ID: ratings_2025_fixture"));
});

test("every CLI validation exit reports a non-zero actionable error", async () => {
  for (const argv of [[], ["--input", "preview.json"], ["--input", "preview.json", "--confirm"]]) {
    const errors = [];
    const code = await executeStageRatingsPreview({ argv, errorLogger: (line) => errors.push(line) });
    assert.equal(code, 1); assert.ok(errors.some((line) => /failed:/i.test(line)));
  }
});

test("existing ready and failed import statuses are explicitly logged", async () => {
  for (const status of ["ready", "failed"]) {
    const logs = [];
    await runStageRatingsPreview({
      argv: stageArguments,
      readPreviewFile: async () => JSON.stringify({ preview: preview() }),
      stagePreview: async ({ preview: value, logger }) => {
        logger(`Existing import ${value.manifest.importId} detected with status ${status}.`);
        if (status === "failed") logger(`Retrying failed import ${value.manifest.importId}; completed matching batches will be reused.`);
        else logger(`Import ${value.manifest.importId} is already ready with 1 staged players.`);
        return { importId: value.manifest.importId, published: false, status };
      },
      logger: (line) => logs.push(line),
    });
    assert.ok(logs.some((line) => line.includes(`status ${status}`)));
    assert.ok(logs.includes("Staged import ID: ratings_2025_fixture"));
  }
});

test("ADC and admin lookup failures are clearly reported", async () => {
  for (const failure of [applicationDefaultCredentialsMessage(), "The supplied Firebase admin user could not be found."]) {
    const errors = [];
    const code = await executeStageRatingsPreview({
      argv: stageArguments,
      readPreviewFile: async () => JSON.stringify({ preview: preview() }),
      stagePreview: async () => { throw new Error(failure); },
      logger: () => {}, errorLogger: (line) => errors.push(line),
    });
    assert.equal(code, 1); assert.ok(errors.join("\n").includes(failure));
  }
});

test("batch failure and success both produce terminal output", async () => {
  const failure = Object.assign(new Error("synthetic batch failure"), { importId: "ratings_2025_fixture", writtenPlayerCount: 250, expectedPlayerCount: 499 });
  const errors = [];
  assert.equal(await executeStageRatingsPreview({ argv: stageArguments, readPreviewFile: async () => JSON.stringify({ preview: preview() }), stagePreview: async () => { throw failure; }, logger: () => {}, errorLogger: (line) => errors.push(line) }), 1);
  assert.ok(errors.includes("Staging failed after 250/499 players.")); assert.ok(errors.includes("Import ID: ratings_2025_fixture"));
  const logs = [];
  assert.equal(await executeStageRatingsPreview({ argv: stageArguments, readPreviewFile: async () => JSON.stringify({ preview: preview() }), stagePreview: async () => ({ importId: "ratings_2025_fixture", published: false }), logger: (line) => logs.push(line), errorLogger: () => {} }), 0);
  assert.ok(logs.includes("Firebase staging complete."));
});

test("direct executable uses awaited top-level completion", async () => {
  const source = await readFile(new URL("../stageRatingsPreview.mjs", import.meta.url), "utf8");
  assert.match(source, /process\.exitCode\s*=\s*await executeStageRatingsPreview\(\)/);
});
