import { describe, expect, test } from 'vitest';
import { getProviderConfig, isAiConfigured, parseEnv } from '@/server/env';

const valid = {
  DATABASE_PATH: './data/rpg.sqlite',
  APP_ORIGIN: 'http://localhost:3000',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_MODEL: 'deepseek-flash',
  AI_MODE: 'deepseek',
};

describe('environment validation', () => {
  test('applies documented defaults without a provider key', () => {
    const env = parseEnv({});
    expect(env.DATABASE_PATH).toBe('./data/rpg.sqlite');
    expect(env.APP_ORIGIN).toBe('http://localhost:3000');
    expect(env.DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com');
    expect(env.DEEPSEEK_MODEL).toBe('deepseek-flash');
    expect(env.AI_MODE).toBe('deepseek');
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(isAiConfigured(env)).toBe(false);
  });

  test('treats a blank provider key as unset', () => {
    const env = parseEnv({ ...valid, DEEPSEEK_API_KEY: '   ' });
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(isAiConfigured(env)).toBe(false);
  });

  test('rejects an invalid APP_ORIGIN', () => {
    expect(() => parseEnv({ APP_ORIGIN: 'not-a-url' })).toThrow(/APP_ORIGIN/);
  });

  test('rejects fixture mode in production', () => {
    expect(() =>
      parseEnv({ AI_MODE: 'fixture', NODE_ENV: 'production' }),
    ).toThrow(/fixture/);
  });

  test('allows fixture mode outside production', () => {
    const env = parseEnv({ AI_MODE: 'fixture', NODE_ENV: 'development' });
    expect(env.AI_MODE).toBe('fixture');
  });

  test('does not read the provider key until configuration is requested', () => {
    const env = parseEnv({ ...valid, DEEPSEEK_API_KEY: 'sk-test-key' });
    expect(isAiConfigured(env)).toBe(true);
    expect(getProviderConfig(env)).toEqual({
      apiKey: 'sk-test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    });
    expect(() => getProviderConfig(parseEnv({}))).toThrow(/AI_NOT_CONFIGURED/);
  });
});
