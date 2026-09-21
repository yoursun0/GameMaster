import 'server-only';

import { cookies } from 'next/headers';
import { createScriptedMaster } from '@/server/ai/fixture';
import { getWorldPacks } from '@/server/content';
import { getDatabase } from '@/server/db/connection';
import { getEnv, isAiConfigured } from '@/server/env';
import { GameServiceError } from '@/server/game/errors';
import { GameService, type OwnerContext } from '@/server/game/service';
import { jsonNoStore } from '@/server/http';
import {
  BROWSER_COOKIE,
  browserCookieOptions,
  parseCookieHeader,
} from '@/server/security/browser';
import { originAllowed } from '@/server/security/origin';
import {
  confirmActionSchema,
  createSessionSchema,
  endSessionSchema,
  localeSchema,
  submitActionSchema,
} from '@/shared/schemas';
import { z } from 'zod';

const MAX_BODY = 8 * 1024;

export function createConfiguredService(): GameService {
  const env = getEnv();
  const provider =
    env.AI_MODE === 'fixture' && env.NODE_ENV !== 'production'
      ? createScriptedMaster()
      : null;
  return new GameService({
    db: getDatabase(env.DATABASE_PATH),
    packs: getWorldPacks(),
    provider: provider ?? (isAiConfigured(env) ? null : null),
  });
}

export async function readJson(
  request: Request,
  locale: 'en' | 'zh-Hant' = 'en',
): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new GameServiceError('INVALID_INPUT', locale);
  }
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength > MAX_BODY) {
    throw new GameServiceError('INVALID_INPUT', locale);
  }
  try {
    return JSON.parse(buffer.toString('utf8')) as unknown;
  } catch {
    throw new GameServiceError('INVALID_INPUT', locale);
  }
}

export function requireOrigin(request: Request): void {
  if (!originAllowed(request.headers.get('origin'), getEnv().APP_ORIGIN)) {
    throw new GameServiceError('ORIGIN_FORBIDDEN');
  }
}

export async function ownerFromRequest(
  request: Request,
): Promise<OwnerContext | null> {
  const jar = await cookies();
  const credential =
    jar.get(BROWSER_COOKIE)?.value ??
    parseCookieHeader(request.headers.get('cookie'));
  const service = createConfiguredService();
  return service.identify(credential);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof GameServiceError) {
    const headers: Record<string, string> = {};
    if (error.code === 'RATE_LIMITED') {
      headers['Retry-After'] = '5';
    }
    return jsonNoStore(error.toJSON(), { status: error.httpStatus, headers });
  }
  if (error instanceof z.ZodError) {
    const wrapped = new GameServiceError('INVALID_INPUT');
    return jsonNoStore(wrapped.toJSON(), { status: wrapped.httpStatus });
  }
  throw error;
}

export async function handleGetSession(request: Request): Promise<Response> {
  try {
    const service = createConfiguredService();
    const owner = await ownerFromRequest(request);
    return jsonNoStore(service.getSession(owner));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleCreateSession(request: Request): Promise<Response> {
  try {
    requireOrigin(request);
    const body = createSessionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    const existing = await ownerFromRequest(request);
    const owner = existing ?? service.issueOwner();
    const result = service.createSession(owner, body);
    const response = jsonNoStore(
      { session: result.session },
      { status: result.status },
    );
    if (owner.issued) {
      const jar = await cookies();
      jar.set(
        BROWSER_COOKIE,
        owner.credential,
        browserCookieOptions(getEnv().APP_ORIGIN.startsWith('https:')),
      );
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleEndSession(request: Request): Promise<Response> {
  try {
    requireOrigin(request);
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const body = endSessionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    return jsonNoStore(service.endSession(owner, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSubmitAction(request: Request): Promise<Response> {
  try {
    requireOrigin(request);
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const command = submitActionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    const result = await service.submitAction(owner, command);
    return jsonNoStore(result, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleGetAction(
  request: Request,
  operationId: string,
): Promise<Response> {
  try {
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const service = createConfiguredService();
    const result = service.getOperation(owner, operationId);
    return jsonNoStore(result, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleConfirmAction(
  request: Request,
  operationId: string,
): Promise<Response> {
  try {
    requireOrigin(request);
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const body = confirmActionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    const result = await service.confirmAction(owner, operationId, body.expectedRevision);
    return jsonNoStore(result, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleRetryAction(
  request: Request,
  operationId: string,
): Promise<Response> {
  try {
    requireOrigin(request);
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const body = confirmActionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    const result = await service.retryAction(owner, operationId, body.expectedRevision);
    return jsonNoStore(result, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleCancelAction(
  request: Request,
  operationId: string,
): Promise<Response> {
  try {
    requireOrigin(request);
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const body = confirmActionSchema.parse(await readJson(request));
    const service = createConfiguredService();
    const result = service.cancelAction(owner, operationId, body.expectedRevision);
    return jsonNoStore(result, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleGetTranscript(request: Request): Promise<Response> {
  try {
    const owner = await ownerFromRequest(request);
    if (!owner) {
      throw new GameServiceError('BROWSER_SESSION_MISSING');
    }
    const url = new URL(request.url);
    const before = url.searchParams.get('before');
    const limit = url.searchParams.get('limit');
    const service = createConfiguredService();
    return jsonNoStore(
      service.getTranscript(owner, {
        before: before ? Number(before) : undefined,
        limit: limit ? Number(limit) : undefined,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleGetCatalog(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locale = localeSchema.parse(url.searchParams.get('locale') ?? 'en');
    const worlds = getWorldPacks().map((pack) => ({
      id: pack.id,
      title: pack.title[locale],
      premise: pack.premise[locale],
      tone: pack.tone[locale],
      characters: pack.characters.map((character) => ({
        id: character.id,
        name: character.name[locale],
        role: character.role[locale],
        profile: character.profile,
        biography: character.biography[locale],
      })),
    }));
    return jsonNoStore({ worlds, locale });
  } catch (error) {
    return errorResponse(error);
  }
}
