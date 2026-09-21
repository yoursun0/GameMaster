import type { Locale } from '@/shared/schemas';
import { en, type UiMessageKey } from './en';
import { zhHant } from './zh-Hant';

export function uiString(
  locale: Locale,
  key: UiMessageKey,
  vars: Record<string, string> = {},
): string {
  const table = locale === 'zh-Hant' ? zhHant : en;
  let text: string = table[key];
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

export type { UiMessageKey };
