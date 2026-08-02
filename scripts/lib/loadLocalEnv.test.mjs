import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadLocalEnv, requireLocalEnv } from "./loadLocalEnv.mjs";

async function withEnvironmentFile(contents, callback) {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "full-court-env-"));
  try {
    await writeFile(path.join(rootDirectory, ".env"), contents, "utf8");
    await callback(rootDirectory);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
}

test("an existing shell value takes precedence over the root .env", async () => {
  await withEnvironmentFile("BALLDONTLIE_API_KEY=file-secret\n", (rootDirectory) => {
    const environment = { BALLDONTLIE_API_KEY: "shell-secret" };
    const status = loadLocalEnv({ rootDirectory, environment });
    assert.equal(status.loaded, true);
    assert.equal(environment.BALLDONTLIE_API_KEY, "shell-secret");
  });
});

test("the project-root .env supplies a missing value", async () => {
  await withEnvironmentFile("BALLDONTLIE_API_KEY=file-secret\n", (rootDirectory) => {
    const environment = {};
    loadLocalEnv({ rootDirectory, environment });
    assert.equal(requireLocalEnv("BALLDONTLIE_API_KEY", { environment }), "file-secret");
  });
});

test("a missing key gives actionable guidance without a secret", () => {
  assert.throws(
    () => requireLocalEnv("BALLDONTLIE_API_KEY", { environment: {} }),
    (error) => {
      assert.match(error.message, /project root \.env/);
      assert.match(error.message, /\$env:BALLDONTLIE_API_KEY/);
      assert.doesNotMatch(error.message, /file-secret|shell-secret/);
      return true;
    },
  );
});

test("loading uses only the supplied server-side environment object", async () => {
  await withEnvironmentFile("BALLDONTLIE_API_KEY=file-secret\nVITE_EXPOSED=value\n", (rootDirectory) => {
    const environment = {};
    const original = process.env.BALLDONTLIE_API_KEY;
    loadLocalEnv({ rootDirectory, environment });
    assert.equal(environment.BALLDONTLIE_API_KEY, "file-secret");
    assert.equal(process.env.BALLDONTLIE_API_KEY, original);
  });
});
