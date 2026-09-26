import 'server-only';

import type { AppEnv } from '@/server/env';
import { getProviderConfig } from '@/server/env';
import { createScriptedMaster } from './fixture';
import { createDeepSeekMaster } from './deepseek';
import type { GameMaster } from './types';

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function selectGameMaster(
  env: AppEnv,
  options: { fetch?: typeof fetch; allowFixture?: boolean } = {},
): GameMaster | null {
  const allowFixture =
    Boolean(options.allowFixture) &&
    env.NODE_ENV !== 'production' &&
    isLoopbackOrigin(env.APP_ORIGIN);
  if (env.AI_MODE === 'fixture') {
    if (!allowFixture) {
      return null;
    }
    return createScriptedMaster();
  }
  if (!env.DEEPSEEK_API_KEY) {
    return null;
  }
  const config = getProviderConfig(env);
  return createDeepSeekMaster({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    fetch: options.fetch,
  });
}
