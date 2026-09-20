import { notImplemented } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return notImplemented();
}

export async function POST(): Promise<Response> {
  return notImplemented();
}
