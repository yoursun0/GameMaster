import type { WorldPack } from '@/server/content/types';
import type { Attribute, Profile } from '@/shared/schemas';

export const ABILITY_COST = 2;
export const ABILITY_MODIFIER = 3;
export const MIN_DIE = 1;
export const MAX_DIE = 20;

export const PROFILE_STATS: Record<
  Profile,
  {
    hp: number;
    mp: number;
    might: number;
    agility: number;
    insight: number;
    presence: number;
    abilityAttribute: Attribute;
  }
> = {
  guardian: {
    hp: 14,
    mp: 4,
    might: 4,
    agility: 2,
    insight: 1,
    presence: 3,
    abilityAttribute: 'might',
  },
  specialist: {
    hp: 10,
    mp: 8,
    might: 1,
    agility: 2,
    insight: 4,
    presence: 3,
    abilityAttribute: 'insight',
  },
  mediator: {
    hp: 12,
    mp: 6,
    might: 2,
    agility: 1,
    insight: 3,
    presence: 4,
    abilityAttribute: 'presence',
  },
  scout: {
    hp: 11,
    mp: 6,
    might: 2,
    agility: 4,
    insight: 3,
    presence: 1,
    abilityAttribute: 'agility',
  },
};

export function characterOf(pack: WorldPack, characterId: string) {
  const character = pack.characters.find((entry) => entry.id === characterId);
  if (!character) {
    throw new Error(`Unknown character ${characterId}`);
  }
  return character;
}

export function profileOf(pack: WorldPack, characterId: string): Profile {
  return characterOf(pack, characterId).profile;
}

export function maxResourcesFor(profile: Profile): { hp: number; mp: number } {
  const stats = PROFILE_STATS[profile];
  return { hp: stats.hp, mp: stats.mp };
}

export function attributeValue(profile: Profile, attribute: Attribute): number {
  return PROFILE_STATS[profile][attribute];
}
