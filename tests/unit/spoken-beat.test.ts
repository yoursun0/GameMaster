import { describe, expect, test } from 'vitest';
import { spokenBeatProblem } from '@/server/ai/validate';
import { illustrationEnabled, maybeIllustrate } from '@/server/ai/images';

describe('spoken beats', () => {
  test('rejects a post-opening narration with no spoken line', () => {
    expect(spokenBeatProblem(['門還在，血也在。'], 'zh-Hant', false)).toBe(
      'Narration needs a spoken line',
    );
  });

  test('rejects a beat over the character cap', () => {
    const long = `塔維喊「門栓」${'雨'.repeat(400)}`;
    expect(spokenBeatProblem([long], 'zh-Hant', false)).toBe('Narration is too long');
  });

  test('accepts a short beat that speaks', () => {
    expect(spokenBeatProblem(['塔維喊「門栓」。凱恩答「我擋。」'], 'zh-Hant', false)).toBeNull();
  });

  test('leaves the opening and questions unchecked', () => {
    expect(spokenBeatProblem(['no quotes here at all'], 'en', true)).toBeNull();
  });
});

describe('scene plates', () => {
  test('does not call an image API until a key exists', async () => {
    expect(illustrationEnabled({})).toBe(false);
    await expect(maybeIllustrate({})).resolves.toBeNull();
  });
});
