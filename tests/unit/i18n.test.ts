import { describe, expect, test } from 'vitest';
import { en } from '@/shared/i18n/en';
import { zhHant } from '@/shared/i18n/zh-Hant';

describe('UI dictionaries', () => {
  test('English and Traditional Chinese expose the same keys', () => {
    expect(Object.keys(zhHant).sort()).toEqual(Object.keys(en).sort());
  });
});
