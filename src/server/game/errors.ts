import 'server-only';

import { uiString, type UiMessageKey } from '@/shared/i18n';
import type { Locale } from '@/shared/schemas';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'ABILITY_NOT_APPLICABLE'
  | 'INSUFFICIENT_MP'
  | 'INVALID_TARGET'
  | 'REPEAT_APPROACH'
  | 'BROWSER_SESSION_MISSING'
  | 'NOT_FOUND'
  | 'STALE_REVISION'
  | 'SESSION_BUSY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REPLACEMENT_REQUIRED'
  | 'SESSION_ENDED'
  | 'CANNOT_CANCEL_RESOLVED'
  | 'RATE_LIMITED'
  | 'AI_INVALID_OUTPUT'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'SAVE_UNAVAILABLE'
  | 'SAVE_VERSION_UNSUPPORTED'
  | 'AI_TIMEOUT'
  | 'ORIGIN_FORBIDDEN';

const STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  ABILITY_NOT_APPLICABLE: 400,
  INSUFFICIENT_MP: 400,
  INVALID_TARGET: 400,
  REPEAT_APPROACH: 400,
  BROWSER_SESSION_MISSING: 401,
  NOT_FOUND: 404,
  STALE_REVISION: 409,
  SESSION_BUSY: 409,
  IDEMPOTENCY_CONFLICT: 409,
  REPLACEMENT_REQUIRED: 409,
  SESSION_ENDED: 409,
  CANNOT_CANCEL_RESOLVED: 409,
  RATE_LIMITED: 429,
  AI_INVALID_OUTPUT: 502,
  AI_NOT_CONFIGURED: 503,
  AI_UNAVAILABLE: 503,
  SAVE_UNAVAILABLE: 503,
  SAVE_VERSION_UNSUPPORTED: 503,
  AI_TIMEOUT: 504,
  ORIGIN_FORBIDDEN: 403,
};

const RETRYABLE: Partial<Record<ErrorCode, boolean>> = {
  RATE_LIMITED: true,
  AI_INVALID_OUTPUT: true,
  AI_UNAVAILABLE: true,
  AI_TIMEOUT: true,
};

export class GameServiceError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly operationId?: string;
  readonly currentRevision?: number;

  constructor(
    code: ErrorCode,
    locale: Locale = 'en',
    extras: { operationId?: string; currentRevision?: number; retryable?: boolean } = {},
  ) {
    const key = `error.${code}` as UiMessageKey;
    super(uiString(locale, key));
    this.name = 'GameServiceError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.retryable = extras.retryable ?? RETRYABLE[code] ?? false;
    this.operationId = extras.operationId;
    this.currentRevision = extras.currentRevision;
  }

  toJSON(): {
    error: {
      code: ErrorCode;
      message: string;
      retryable: boolean;
      operationId?: string;
    };
    currentRevision?: number;
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.operationId ? { operationId: this.operationId } : {}),
      },
      ...(this.currentRevision !== undefined
        ? { currentRevision: this.currentRevision }
        : {}),
    };
  }
}
