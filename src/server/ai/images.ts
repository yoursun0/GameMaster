import 'server-only';

import type { AppEnv } from '@/server/env';

export const SCENE_PLATE = '/stage/hall.jpg';

/** Live beat art stays off until a separate image key is configured. Play never waits on it. */
export function illustrationEnabled(env: Partial<Pick<AppEnv, 'IMAGE_API_URL' | 'IMAGE_API_KEY'>>): boolean {
  return Boolean(env.IMAGE_API_URL && env.IMAGE_API_KEY);
}

export async function maybeIllustrate(
  env: Partial<Pick<AppEnv, 'IMAGE_API_URL' | 'IMAGE_API_KEY'>>,
): Promise<string | null> {
  if (!illustrationEnabled(env)) return null;
  return null;
}
