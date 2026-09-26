import 'server-only';

import type { WorldPack } from './types';
import { ashenThrones } from './worlds/ashen-thrones';

export function getWorldPacks(): WorldPack[] {
  return [ashenThrones];
}

export function getWorldPack(id: string): WorldPack | undefined {
  return getWorldPacks().find((pack) => pack.id === id);
}
