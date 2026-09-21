import 'server-only';

import { randomBytes } from 'node:crypto';
import { sha256Hex } from '@/server/game/hash';

export const BROWSER_COOKIE = 'rpg_browser';
export const BROWSER_COOKIE_MAX_AGE = 31_536_000;

export function issueBrowserCredential(): string {
  return randomBytes(32).toString('base64url');
}

export function hashBrowserCredential(credential: string): string {
  return sha256Hex(credential);
}

export function parseCookieHeader(
  header: string | null,
  name: string = BROWSER_COOKIE,
): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) {
      return rest.join('=') || undefined;
    }
  }
  return undefined;
}

export function browserCookieOptions(secure: boolean): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: BROWSER_COOKIE_MAX_AGE,
    secure,
  };
}
