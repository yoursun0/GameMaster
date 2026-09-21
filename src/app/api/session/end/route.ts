import { handleEndSession } from '@/server/http/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleEndSession(request);
}
