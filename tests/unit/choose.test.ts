import { describe, expect, test } from 'vitest';
import { chooseAction } from '@/server/game/choose';

const approaches = [
  { id: 'ash-s0-might', label: '頂住店門', attribute: 'might' as const },
  { id: 'ash-s0-agility', label: '從廚房拖走信差', attribute: 'agility' as const },
  { id: 'ash-s0-insight', label: '搶下信並辨認封蠟', attribute: 'insight' as const },
  { id: 'ash-s0-presence', label: '讓塔維一起落下門栓', attribute: 'presence' as const },
];
const suggestions = approaches.slice(0, 3).map((approach) => ({
  text: approach.label,
  approachId: approach.id,
}));
const availableIds = approaches.map((approach) => approach.id);

describe('engine choice', () => {
  test('a listed move is that approach', () => {
    expect(
      chooseAction({
        text: '搶下信並辨認封蠟',
        closing: false,
        suggestions,
        approaches,
        availableIds,
      }),
    ).toMatchObject({ kind: 'check', approachId: 'ash-s0-insight', toll: 'none' });
  });

  test('creative wording still maps onto a fight instead of a clarification', () => {
    const chosen = chooseAction({
      text: '留下殿後，獨自擋住追兵',
      closing: false,
      suggestions,
      approaches,
      availableIds,
    });
    expect(chosen.kind).toBe('check');
    if (chosen.kind === 'check') {
      expect(chosen.approachId).toBe('ash-s0-might');
    }
  });

  test('a closed fight does not ask the model or the player to choose again', () => {
    expect(
      chooseAction({
        text: '留下殿後，獨自擋住追兵',
        closing: true,
        suggestions,
        approaches,
        availableIds: [],
      }),
    ).toMatchObject({ kind: 'automatic' });
  });

  test('text that matches nothing still enters the fight at a cost', () => {
    expect(
      chooseAction({
        text: 'Paint the moon purple.',
        closing: false,
        suggestions,
        approaches,
        availableIds,
      }),
    ).toMatchObject({ kind: 'check', approachId: 'ash-s0-might', toll: 'reckless' });
  });
});
