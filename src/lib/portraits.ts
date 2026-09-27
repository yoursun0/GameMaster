import type { Locale } from '@/shared/schemas';

export type Portrait = {
  id: string;
  src: string;
  alt: Record<Locale, string>;
};

export const PORTRAITS: readonly Portrait[] = [
  {
    id: 'face-01',
    src: '/portraits/face-01.jpg',
    alt: { en: 'Scarred man in a hood', 'zh-Hant': '兜帽裡的疤痕男子' },
  },
  {
    id: 'face-02',
    src: '/portraits/face-02.jpg',
    alt: { en: 'Woman with a pale braid', 'zh-Hant': '銀白長辮的女子' },
  },
  {
    id: 'face-03',
    src: '/portraits/face-03.jpg',
    alt: { en: 'Young man in a black fur collar', 'zh-Hant': '黑毛皮領的青年' },
  },
  {
    id: 'face-04',
    src: '/portraits/face-04.jpg',
    alt: { en: 'Grey-bearded veteran', 'zh-Hant': '灰鬍的老兵' },
  },
  {
    id: 'face-05',
    src: '/portraits/face-05.jpg',
    alt: { en: 'Woman in a leather jerkin', 'zh-Hant': '皮甲低髻的女子' },
  },
  {
    id: 'face-06',
    src: '/portraits/face-06.jpg',
    alt: { en: 'Freckled youth with auburn curls', 'zh-Hant': '赤褐捲髮的青年' },
  },
  {
    id: 'face-07',
    src: '/portraits/face-07.jpg',
    alt: { en: 'Captain in a steel gorget', 'zh-Hant': '鋼領甲的女隊長' },
  },
  {
    id: 'face-08',
    src: '/portraits/face-08.jpg',
    alt: { en: 'Elder with a white beard', 'zh-Hant': '白鬍的老者' },
  },
  {
    id: 'face-09',
    src: '/portraits/face-09.jpg',
    alt: { en: 'Man in a mail collar', 'zh-Hant': '鎖子甲領的捲髮男子' },
  },
  {
    id: 'face-10',
    src: '/portraits/face-10.jpg',
    alt: { en: 'Woman with long auburn hair', 'zh-Hant': '赤褐長髮的女子' },
  },
  {
    id: 'face-11',
    src: '/portraits/face-11.jpg',
    alt: { en: 'Bald man in a gold collar', 'zh-Hant': '金領的光頭男子' },
  },
  {
    id: 'face-12',
    src: '/portraits/face-12.jpg',
    alt: { en: 'Woman with a silver circlet', 'zh-Hant': '銀冠短髮的女子' },
  },
];

const STORAGE_PREFIX = 'tales-beyond.faces.';

export function portraitById(id: string): Portrait {
  return PORTRAITS.find((portrait) => portrait.id === id) ?? PORTRAITS[0];
}

export function isPortraitId(id: string): boolean {
  return PORTRAITS.some((portrait) => portrait.id === id);
}

export function dealFaces(count: number, random: () => number = Math.random): string[] {
  const ids = PORTRAITS.map((portrait) => portrait.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = ids[index] ?? ids[0];
    ids[index] = ids[swapIndex] ?? current;
    ids[swapIndex] = current;
  }
  const safeCount = Math.max(0, Math.min(count, ids.length));
  return ids.slice(0, safeCount);
}

export function stepFace(
  current: string,
  direction: 1 | -1,
  taken: ReadonlySet<string>,
): string {
  const ring = PORTRAITS.map((portrait) => portrait.id).filter(
    (id) => id === current || !taken.has(id),
  );
  if (ring.length === 0) return current;
  const index = Math.max(0, ring.indexOf(current));
  return ring[(index + direction + ring.length) % ring.length] ?? current;
}

export function faceForPlayer(
  map: Record<string, string>,
  playerId: string,
  seat: number,
): string {
  const chosen = map[playerId];
  if (chosen && isPortraitId(chosen)) return chosen;
  return PORTRAITS[Math.abs(seat) % PORTRAITS.length]?.id ?? PORTRAITS[0].id;
}

export function saveFaceMap(
  sessionId: string,
  party: Array<{ playerId: string; seat: number }>,
  faces: readonly string[],
): void {
  const map: Record<string, string> = {};
  for (const member of party) {
    const face = faces[member.seat];
    if (face && isPortraitId(face)) map[member.playerId] = face;
  }
  localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(map));
}

export function readFaceMap(sessionId: string): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const map: Record<string, string> = {};
    for (const [playerId, faceId] of Object.entries(parsed)) {
      if (typeof faceId === 'string' && isPortraitId(faceId)) map[playerId] = faceId;
    }
    return map;
  } catch {
    return {};
  }
}
