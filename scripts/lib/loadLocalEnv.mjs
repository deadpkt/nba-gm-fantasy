import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptsDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const repositoryRoot = path.resolve(scriptsDirectory, "..");

export function loadLocalEnv({ rootDirectory = repositoryRoot, environment = process.env } = {}) {
  const envPath = path.resolve(rootDirectory, ".env");
  if (!existsSync(envPath)) return { envPath, loaded: false };

  const result = dotenv.config({
    path: envPath,
    override: false,
    processEnv: environment,
    quiet: true,
  });

  if (result.error) throw new Error(`Could not load the project environment file: ${result.error.message}`);
  return { envPath, loaded: true };
}

export function requireLocalEnv(name, { environment = process.env } = {}) {
  const value = environment[name];
  if (typeof value === "string" && value.trim()) return value;

  throw new Error(
    `${name} is not configured.\n\n` +
      `Add this line to the project root .env file:\n\n${name}=your_secret_key\n\n` +
      `or set it in PowerShell:\n\n$env:${name}="your_secret_key"`,
  );
}
