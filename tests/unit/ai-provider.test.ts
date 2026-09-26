import { describe, expect, test } from 'vitest';
import { isLoopbackOrigin, selectGameMaster } from '@/server/ai/provider';
import type { AppEnv } from '@/server/env';

const base: AppEnv = {
  DATABASE_PATH: './data/rpg.sqlite',
  APP_ORIGIN: 'http://localhost:3000',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_MODEL: 'deepseek-flash',
  DEEPSEEK_API_KEY: undefined,
  AI_MODE: 'deepseek',
};

describe('provider selection', () => {
  test('never uses the fixture adapter in production', () => {
    expect(
      selectGameMaster(
        { ...base, NODE_ENV: 'production', AI_MODE: 'fixture' },
        { allowFixture: true },
      ),
    ).toBeNull();
    expect(
      selectGameMaster(
        { ...base, NODE_ENV: 'production', DEEPSEEK_API_KEY: undefined },
        { allowFixture: true },
      ),
    ).toBeNull();
  });

  test('uses DeepSeek when a server key is configured', () => {
    const master = selectGameMaster({
      ...base,
      NODE_ENV: 'production',
      DEEPSEEK_API_KEY: 'sk-server-only',
    });
    expect(master).not.toBeNull();
    expect(master?.interpret).toBeTypeOf('function');
  });

  test('fixture mode also requires a loopback origin', () => {
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackOrigin('https://example.com')).toBe(false);
    expect(
      selectGameMaster(
        {
          ...base,
          NODE_ENV: 'development',
          AI_MODE: 'fixture',
          APP_ORIGIN: 'https://example.com',
        },
        { allowFixture: true },
      ),
    ).toBeNull();
  });

  test('allows the scripted adapter only in non-production fixture mode', () => {
    expect(
      selectGameMaster(
        { ...base, NODE_ENV: 'development', AI_MODE: 'fixture' },
        { allowFixture: true },
      ),
    ).not.toBeNull();
    expect(
      selectGameMaster(
        { ...base, NODE_ENV: 'development', AI_MODE: 'fixture' },
        { allowFixture: false },
      ),
    ).toBeNull();
  });
});
