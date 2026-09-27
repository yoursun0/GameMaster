import { describe, expect, test } from 'vitest';
import { openingParagraphs } from '@/server/content/opening';
import { ashenThrones } from '@/server/content/worlds/ashen-thrones';
import { collectWorldPackIssues, validateWorldPack } from '@/server/content/validate';
import { getWorldPacks } from '@/server/content';

describe('Ashen Thrones pack', () => {
  test('opens on a fight and names the next place', () => {
    const scene = ashenThrones.scenes[0];
    expect(scene.opening.en).toContain('north road');
    expect(scene.clearedTransition.en).toContain('north road');
    expect(scene.approaches.find((approach) => approach.attribute === 'might')?.risk).toBe(
      'strain',
    );
    expect(ashenThrones.scenes[1].opening.en).toContain('Crowkeep');
    expect(ashenThrones.scenes[7].objective.en).toContain('champion');
  });

  test('opens with one fixed briefing of the war, the seated cast, and the story goal', () => {
    const party = [
      { characterId: 'ash-knight', displayName: '凱恩' },
      { characterId: 'ash-scholar', displayName: '莉雅' },
      { characterId: 'ash-envoy', displayName: '席恩' },
      { characterId: 'ash-scout', displayName: '艾菈' },
    ];
    const scene = ashenThrones.scenes[0]?.opening['zh-Hant'] ?? '';
    const first = openingParagraphs(ashenThrones, party, 'zh-Hant', scene);
    const again = openingParagraphs(ashenThrones, party, 'zh-Hant', scene);
    const text = first.join('');
    expect(again).toEqual(first);
    expect(first.at(-1)).toBe(scene);
    expect(text).toContain('真名');
    expect(text).toContain('鐘');
    expect(text).toContain('負傷的奧倫把一封封了蠟的信塞進你們手裡，隨即倒下');
    expect(text).toContain('凱恩');
    expect(text).toContain('莉雅');
    expect(text).toContain('你們認得彼此');
    expect(text).not.toContain('為清洗正名');

    const solo = openingParagraphs(
      ashenThrones,
      [{ characterId: 'ash-knight', displayName: '凱恩' }],
      'zh-Hant',
      scene,
    ).join('');
    expect(solo).toContain('凱恩');
    expect(solo).not.toContain('莉雅');
    const renamed = openingParagraphs(
      ashenThrones,
      [{ characterId: 'ash-knight', displayName: 'Jon' }],
      'zh-Hant',
      scene,
    ).join('');
    expect(renamed).toContain('Jon是被放逐的護衛');
    expect(renamed).not.toContain('凱恩');
    expect(solo).not.toContain('席恩');
    expect(solo).not.toContain('艾菈');
  });

  test('passes content validation', () => {
    expect(collectWorldPackIssues(ashenThrones)).toEqual([]);
    expect(() => validateWorldPack(ashenThrones)).not.toThrow();
  });

  test('is registered and keeps the private truth out of the catalogue shape', () => {
    expect(getWorldPacks().map((pack) => pack.id)).toContain('ashen-thrones');
    const publicCard = {
      id: ashenThrones.id,
      title: ashenThrones.title,
      premise: ashenThrones.premise,
      characters: ashenThrones.characters.map((character) => ({
        id: character.id,
        biography: character.biography,
      })),
    };
    const serialized = JSON.stringify(publicCard);
    expect(serialized).not.toContain('ash-truth-altered-genealogy');
    expect(serialized).not.toContain('justify a purge');
    expect(serialized).not.toContain('為清洗正名');
  });
});
