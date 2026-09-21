import { handleCreateSession, handleGetSession } from '@/server/http/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleGetSession(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleCreateSession(request);
}
