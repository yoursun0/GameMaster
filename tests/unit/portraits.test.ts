import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  PORTRAITS,
  dealFaces,
  faceForPlayer,
  readFaceMap,
  saveFaceMap,
  stepFace,
} from '@/lib/portraits';

describe('portrait choice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('deals a unique face for each seat', () => {
    const faces = dealFaces(4, () => 0.5);
    expect(faces).toHaveLength(4);
    expect(new Set(faces).size).toBe(4);
    expect(faces.every((id) => PORTRAITS.some((portrait) => portrait.id === id))).toBe(true);
  });

  test('steps past a face another seat already holds', () => {
    const first = PORTRAITS[0]?.id ?? '';
    const second = PORTRAITS[1]?.id ?? '';
    const third = PORTRAITS[2]?.id ?? '';
    expect(stepFace(first, 1, new Set([second]))).toBe(third);
    expect(stepFace(first, -1, new Set())).toBe(PORTRAITS[PORTRAITS.length - 1]?.id);
  });

  test('keeps a chosen face on the player and falls back by seat', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    saveFaceMap('session-1', [{ playerId: 'p1', seat: 0 }], [PORTRAITS[3]?.id ?? '']);
    expect(readFaceMap('session-1')).toEqual({ p1: PORTRAITS[3]?.id });
    expect(faceForPlayer({}, 'missing', 2)).toBe(PORTRAITS[2]?.id);
    expect(faceForPlayer({ p1: 'not-a-face' }, 'p1', 1)).toBe(PORTRAITS[1]?.id);
  });
});
