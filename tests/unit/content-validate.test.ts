import { describe, expect, test } from 'vitest';
import {
  ContentValidationError,
  collectWorldPackIssues,
  validateWorldPack,
  validateWorldPacks,
} from '@/server/content/validate';
import { testCampaign } from '../fixtures/test-campaign';

describe('content validator', () => {
  test('accepts the deterministic test campaign', () => {
    expect(() =>
      validateWorldPack(testCampaign, { requireCanonicalId: false }),
    ).not.toThrow();
    expect(collectWorldPackIssues(testCampaign, { requireCanonicalId: false })).toEqual([]);
  });

  test('rejects a pack missing a rest scene and reports the path', () => {
    const broken = structuredClone(testCampaign);
    broken.scenes[3].restAllowed = false;
    const issues = collectWorldPackIssues(broken, { requireCanonicalId: false });
    expect(issues.some((issue) => issue.path === 'test-campaign/scenes')).toBe(true);
  });

  test('fails an empty production registry', () => {
    expect(() => validateWorldPacks([])).toThrow(ContentValidationError);
  });
});
