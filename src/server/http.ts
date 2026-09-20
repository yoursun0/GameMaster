import 'server-only';

export function jsonNoStore(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(body, { ...init, headers });
}

export function notImplemented(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This endpoint is not available yet.',
        retryable: false,
      },
    },
    { status: 501 },
  );
}
