import { describe, expect, test } from 'vitest';
import { ashenThrones } from '@/server/content/worlds/ashen-thrones';
import { collectWorldPackIssues, validateWorldPack } from '@/server/content/validate';
import { getWorldPacks } from '@/server/content';

describe('Ashen Thrones pack', () => {
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
