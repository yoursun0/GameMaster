import { getEnv, isAiConfigured } from '@/server/env';
import { jsonNoStore } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const env = getEnv();
  const fixture =
    env.AI_MODE === 'fixture' && env.NODE_ENV !== 'production';
  return jsonNoStore({
    status: 'ok',
    aiConfigured: isAiConfigured(env) || fixture,
  });
}
