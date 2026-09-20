import { isAiConfigured } from '@/server/env';
import { jsonNoStore } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return jsonNoStore({
    status: 'ok',
    aiConfigured: isAiConfigured(),
  });
}
