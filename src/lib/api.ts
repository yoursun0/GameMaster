export type ApiError = {
  code?: string;
  message: string;
  retryable?: boolean;
  operationId?: string;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const envelope = data as { error?: ApiError; currentRevision?: number };
    const error = Object.assign(new Error(envelope.error?.message ?? response.statusText), {
      code: envelope.error?.code,
      retryable: envelope.error?.retryable,
      operationId: envelope.error?.operationId,
      currentRevision: envelope.currentRevision,
    });
    throw error;
  }
  return data as T;
}
