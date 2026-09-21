import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { submitActionSchema } from '@/shared/schemas';

const base = {
  operationId: randomUUID(),
  expectedRevision: 0,
  actorId: randomUUID(),
};

describe('submit action schemas', () => {
  test('accepts a strict act command', () => {
    const parsed = submitActionSchema.parse({
      ...base,
      kind: 'act',
      text: 'I show the seal.',
      useAbility: true,
    });
    expect(parsed.kind).toBe('act');
  });

  test('rejects meaningless field combinations', () => {
    const result = submitActionSchema.safeParse({
      ...base,
      kind: 'pass',
      text: 'should not be here',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an empty act', () => {
    expect(
      submitActionSchema.safeParse({ ...base, kind: 'act', text: '   ' }).success,
    ).toBe(false);
  });
});
