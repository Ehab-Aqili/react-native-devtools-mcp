import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { DetailLevelSchema } from "@rn-devtools/shared";

export const ConfigSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Directory (relative to cwd, unless absolute) where heavy artifacts are written. */
  dataDir: z.string().default(".rn-devtools"),
  defaultDetail: DetailLevelSchema.default("summary"),
  metro: z
    .object({
      host: z.string().default("localhost"),
      port: z.number().int().positive().default(8081),
    })
    .default({ host: "localhost", port: 8081 }),
});

export type Config = z.infer<typeof ConfigSchema>;

const CONFIG_FILE_NAMES = ["rn-devtools.config.json", ".rn-devtools.config.json"];

const ENV_PREFIX = "RN_DEVTOOLS_";

function readConfigFile(cwd: string): Record<string, unknown> {
  for (const fileName of CONFIG_FILE_NAMES) {
    const path = join(cwd, fileName);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    }
  }
  return {};
}

function readEnvOverrides(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const metro: Record<string, unknown> = {};

  if (env[`${ENV_PREFIX}LOG_LEVEL`] !== undefined) {
    overrides.logLevel = env[`${ENV_PREFIX}LOG_LEVEL`];
  }
  if (env[`${ENV_PREFIX}DATA_DIR`] !== undefined) {
    overrides.dataDir = env[`${ENV_PREFIX}DATA_DIR`];
  }
  if (env[`${ENV_PREFIX}DEFAULT_DETAIL`] !== undefined) {
    overrides.defaultDetail = env[`${ENV_PREFIX}DEFAULT_DETAIL`];
  }
  if (env[`${ENV_PREFIX}METRO_HOST`] !== undefined) {
    metro.host = env[`${ENV_PREFIX}METRO_HOST`];
  }
  if (env[`${ENV_PREFIX}METRO_PORT`] !== undefined) {
    metro.port = Number(env[`${ENV_PREFIX}METRO_PORT`]);
  }
  if (Object.keys(metro).length > 0) {
    overrides.metro = metro;
  }

  return overrides;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = merged[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = deepMerge(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export interface LoadConfigOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly overrides?: Record<string, unknown>;
}

/**
 * Layered config resolution: schema defaults -> config file -> env vars ->
 * explicit overrides (highest precedence, mainly for tests/programmatic use).
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  let merged: Record<string, unknown> = readConfigFile(cwd);
  merged = deepMerge(merged, readEnvOverrides(env));
  if (options.overrides) {
    merged = deepMerge(merged, options.overrides);
  }

  return ConfigSchema.parse(merged);
}
