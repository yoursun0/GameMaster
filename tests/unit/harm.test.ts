import { describe, expect, test } from 'vitest';
import { extraAfterToll, storyHarm } from '@/server/game/harm';

const party = [
  { playerId: 'jon', displayName: 'JON SNOW' },
  { playerId: 'dany', displayName: '龍媽' },
];

describe('story harm', () => {
  test('a burn written on a player costs 2 HP after the prose', () => {
    const harms = storyHarm({
      paragraphs: [
        'JON SNOW 的袖口被火燎焦了一塊，手背燙出一片紅。',
        '傭兵撞上桌角，血從他自己的眉骨留下來。',
      ],
      party,
    });
    expect(harms).toEqual([
      {
        playerId: 'jon',
        hp: 2,
        mp: 0,
        cause: 'JON SNOW 的袖口被火燎焦了一塊，手背燙出一片紅',
      },
    ]);
  });

  test('the system still charges a wound when the model reports none', () => {
    const harms = storyHarm({
      paragraphs: ['龍媽指節上蹭破了一道口子，血混著蠟屑黏在紙上。'],
      party,
      proposed: [{ playerId: 'dany', hp: 0, mp: 0 }],
    });
    expect(harms).toEqual([
      {
        playerId: 'dany',
        hp: 2,
        mp: 0,
        cause: '龍媽指節上蹭破了一道口子，血混著蠟屑黏在紙上',
      },
    ]);
  });

  test('keeps a model harm even when the wording is quieter than the marks', () => {
    const harms = storyHarm({
      paragraphs: ['JON SNOW 把水潑向門框，火頭矮了半截。'],
      party,
      proposed: [{ playerId: 'jon', hp: 2, mp: 0 }],
    });
    expect(harms).toEqual([{ playerId: 'jon', hp: 2, mp: 0, cause: null }]);
  });

  test('the actor keeps the higher of the check toll and the prose wound', () => {
    expect(extraAfterToll(2, 2)).toBe(0);
    expect(extraAfterToll(2, 1)).toBe(1);
    expect(extraAfterToll(0, 2)).toBe(0);
  });
});
