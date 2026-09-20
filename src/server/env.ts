import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const aiModeSchema = z.enum(['deepseek', 'fixture']);

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  DATABASE_PATH: z.string().min(1).default('./data/rpg.sqlite'),
  APP_ORIGIN: z.url().default('http://localhost:3000'),
  DEEPSEEK_BASE_URL: z.url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-flash'),
  DEEPSEEK_API_KEY: optionalSecret,
  AI_MODE: aiModeSchema.default('deepseek'),
});

export type AppEnv = z.infer<typeof envSchema>;

export type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function parseDotEnv(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function readDotEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  return parseDotEnv(readFileSync(filePath, 'utf8'));
}

export function loadLocalEnv(cwd: string = process.cwd()): void {
  const fromFiles = {
    ...readDotEnvFile(join(cwd, '.env')),
    ...readDotEnvFile(join(cwd, '.env.local')),
  };
  for (const [key, value] of Object.entries(fromFiles)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function parseEnv(
  source: Record<string, string | undefined>,
): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }

  if (result.data.AI_MODE === 'fixture' && result.data.NODE_ENV === 'production') {
    throw new Error('AI_MODE=fixture is not allowed in production');
  }

  return result.data;
}

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cached) {
    loadLocalEnv();
    cached = parseEnv(process.env);
  }
  return cached;
}

export function isAiConfigured(env: AppEnv = getEnv()): boolean {
  return Boolean(env.DEEPSEEK_API_KEY);
}

export function getProviderConfig(env: AppEnv = getEnv()): ProviderConfig {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  return {
    apiKey,
    baseUrl: env.DEEPSEEK_BASE_URL,
    model: env.DEEPSEEK_MODEL,
  };
}
