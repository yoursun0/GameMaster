import { handleGetCatalog } from '@/server/http/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleGetCatalog(request);
}
