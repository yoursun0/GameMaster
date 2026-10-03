import { describe, expect, test } from 'vitest';
import { assertNarration, spokenBeatProblem } from '@/server/ai/validate';
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

  test('an item beat keeps the spoken scene and drops proposed wounds', () => {
    const narration = assertNarration(
      {
        paragraphs: ['龍媽拔開療傷藥。「喝。」塔維說「還站得住。」'],
        quote: null,
        prompt: '下一手。',
        suggestions: [
          { text: '頂住店門', approachId: 's0-might' },
          { text: '辨認封蠟', approachId: 's0-insight' },
        ],
        journalFact: null,
        ending: null,
        harms: [{ playerId: 'p1', hp: 2 }],
      },
      {
        locale: 'zh-Hant',
        actorId: 'p1',
        outcome: 'use_item',
        availableApproachIds: ['s0-might', 's0-insight'],
        partyPlayerIds: ['p1'],
        itemUse: {
          itemId: 'test-restorative',
          itemName: '療傷藥',
          actorName: '龍媽',
          targetPlayerId: 'p1',
          targetName: '龍媽',
          hpRestored: 4,
          mpRestored: 0,
        },
      },
    );
    expect(narration.harms).toEqual([]);
    expect(narration.paragraphs[0]).toContain('喝');
  });
});

describe('scene plates', () => {
  test('does not call an image API until a key exists', async () => {
    expect(illustrationEnabled({})).toBe(false);
    await expect(maybeIllustrate({})).resolves.toBeNull();
  });
});
