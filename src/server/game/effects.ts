import type { WorldPack } from '@/server/content/types';
import type { ConditionId } from '@/shared/schemas';
import type { CharacterState, SessionState } from './schemas';
import { REST_USED_FLAG } from './schemas';
import { maxResourcesFor, profileOf } from './profiles';

export type Effect =
  | { type: 'damage'; playerId: string; resource: 'hp' | 'mp'; amount: number }
  | { type: 'restore'; playerId: string; resource: 'hp' | 'mp'; amount: number }
  | { type: 'trust'; npcId: string; amount: number }
  | { type: 'progress'; amount: number }
  | { type: 'threat'; amount: number }
  | { type: 'grant_item'; itemId: string }
  | { type: 'consume_item'; itemId: string }
  | { type: 'set_flag'; flagId: string }
  | { type: 'reveal_fact'; factId: string }
  | { type: 'apply_condition'; playerId: string; conditionId: ConditionId }
  | { type: 'remove_condition'; playerId: string; conditionId: ConditionId };

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function riskEffects(
  risk: 'strain' | 'pressure' | 'trust',
  outcome: 'success' | 'partial' | 'failure',
  actorId: string,
  npcId: string | undefined,
): Effect[] {
  if (risk === 'strain') {
    if (outcome === 'success') return [{ type: 'progress', amount: 2 }];
    if (outcome === 'partial') {
      return [
        { type: 'progress', amount: 1 },
        { type: 'damage', playerId: actorId, resource: 'hp', amount: 1 },
      ];
    }
    return [
      { type: 'damage', playerId: actorId, resource: 'hp', amount: 2 },
      { type: 'threat', amount: 1 },
    ];
  }
  if (risk === 'pressure') {
    if (outcome === 'success') return [{ type: 'progress', amount: 2 }];
    if (outcome === 'partial') {
      return [
        { type: 'progress', amount: 1 },
        { type: 'threat', amount: 1 },
      ];
    }
    return [{ type: 'threat', amount: 1 }];
  }
  if (!npcId) {
    throw new Error('trust risk requires npcId');
  }
  if (outcome === 'success') {
    return [
      { type: 'progress', amount: 2 },
      { type: 'trust', npcId, amount: 1 },
    ];
  }
  if (outcome === 'partial') {
    return [
      { type: 'progress', amount: 1 },
      { type: 'threat', amount: 1 },
    ];
  }
  return [
    { type: 'trust', npcId, amount: -1 },
    { type: 'threat', amount: 1 },
  ];
}

export function validateEffects(
  state: SessionState,
  pack: WorldPack,
  effects: Effect[],
): boolean {
  const itemIds = new Set(pack.items.map((item) => item.id));
  const factIds = new Set(pack.facts.map((fact) => fact.id));
  const flagIds = new Set(pack.flags);
  const npcIds = new Set(pack.npcs.map((npc) => npc.id));
  const playerIds = new Set(state.party.map((member) => member.playerId));

  for (const effect of effects) {
    switch (effect.type) {
      case 'damage':
      case 'restore':
      case 'apply_condition':
      case 'remove_condition':
        if (!playerIds.has(effect.playerId)) return false;
        break;
      case 'trust':
        if (!npcIds.has(effect.npcId)) return false;
        break;
      case 'grant_item':
      case 'consume_item':
        if (!itemIds.has(effect.itemId)) return false;
        break;
      case 'set_flag':
        if (!flagIds.has(effect.flagId)) return false;
        break;
      case 'reveal_fact':
        if (!factIds.has(effect.factId)) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

function member(state: SessionState, playerId: string): CharacterState {
  const found = state.party.find((entry) => entry.playerId === playerId);
  if (!found) {
    throw new Error(`Unknown player ${playerId}`);
  }
  return found;
}

export function applyEffects(
  state: SessionState,
  pack: WorldPack,
  effects: Effect[],
): SessionState {
  const next: SessionState = structuredClone(state);
  for (const effect of effects) {
    switch (effect.type) {
      case 'damage': {
        const target = member(next, effect.playerId);
        target[effect.resource] = Math.max(0, target[effect.resource] - effect.amount);
        break;
      }
      case 'restore': {
        const target = member(next, effect.playerId);
        const max = maxResourcesFor(profileOf(pack, target.characterId));
        const cap = effect.resource === 'hp' ? max.hp : max.mp;
        target[effect.resource] = clamp(target[effect.resource] + effect.amount, 0, cap);
        break;
      }
      case 'trust':
        next.npcTrust[effect.npcId] = clamp(
          (next.npcTrust[effect.npcId] ?? 0) + effect.amount,
          -2,
          2,
        );
        break;
      case 'progress':
        next.scene.progress += effect.amount;
        break;
      case 'threat':
        next.scene.threat += effect.amount;
        break;
      case 'grant_item': {
        const definition = pack.items.find((item) => item.id === effect.itemId);
        const existing = next.inventory.find(
          (item) => item.itemId === effect.itemId && item.ownerId === null,
        );
        if (definition?.kind === 'story' && existing) {
          break;
        }
        if (existing) {
          existing.quantity += 1;
        } else {
          next.inventory.push({
            itemId: effect.itemId,
            quantity: 1,
            ownerId: null,
          });
        }
        break;
      }
      case 'consume_item': {
        const stack = next.inventory.find(
          (item) => item.itemId === effect.itemId && item.quantity > 0,
        );
        if (!stack) break;
        stack.quantity -= 1;
        if (stack.quantity <= 0) {
          next.inventory = next.inventory.filter((item) => item !== stack);
        }
        break;
      }
      case 'set_flag':
        if (!next.flags.includes(effect.flagId)) {
          next.flags.push(effect.flagId);
        }
        break;
      case 'reveal_fact':
        if (!next.revealedFactIds.includes(effect.factId)) {
          next.revealedFactIds.push(effect.factId);
        }
        break;
      case 'apply_condition': {
        const target = member(next, effect.playerId);
        if (target.conditions.some((condition) => condition.id === effect.conditionId)) {
          break;
        }
        target.conditions.push({
          id: effect.conditionId,
          appliedAtAction: next.committedActionCount,
          expires: effect.conditionId === 'focused' ? 'next_check' : 'scene_end',
        });
        break;
      }
      case 'remove_condition': {
        const target = member(next, effect.playerId);
        target.conditions = target.conditions.filter(
          (condition) => condition.id !== effect.conditionId,
        );
        break;
      }
      default:
        break;
    }
  }
  for (const target of next.party) {
    const max = maxResourcesFor(profileOf(pack, target.characterId));
    target.hp = clamp(target.hp, 0, max.hp);
    target.mp = clamp(target.mp, 0, max.mp);
  }
  return next;
}

export { REST_USED_FLAG };
