import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  PORTRAITS,
  ROLE_FACE_IDS,
  dealFaces,
  faceForPlayer,
  facesForRole,
  firstFreeFace,
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

  test('keeps each role inside its own face pool', () => {
    const seen = new Set<string>();
    for (const [role, faces] of Object.entries(ROLE_FACE_IDS)) {
      expect(facesForRole(role)).toEqual(faces);
      expect(faces).toHaveLength(3);
      for (const face of faces) {
        expect(seen.has(face)).toBe(false);
        expect(PORTRAITS.some((portrait) => portrait.id === face)).toBe(true);
        seen.add(face);
      }
    }
    expect(firstFreeFace('ash-scholar', new Set(['face-02']))).toBe('face-10');
    expect(firstFreeFace('ash-scholar', new Set(), 'face-01')).toBe('face-02');
    expect(stepFace('face-02', 1, new Set(), facesForRole('ash-scholar'))).toBe('face-10');
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
