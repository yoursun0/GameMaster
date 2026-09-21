import { randomInt } from 'node:crypto';
import type { ApproachDefinition, WorldPack } from '@/server/content/types';
import { en } from '@/shared/i18n/en';
import { zhHant } from '@/shared/i18n/zh-Hant';
import type { Attribute, Difficulty, Locale } from '@/shared/schemas';
import {
  applyEffects,
  clamp,
  riskEffects,
  validateEffects,
  type Effect,
} from './effects';
import {
  ABILITY_COST,
  ABILITY_MODIFIER,
  MAX_DIE,
  MIN_DIE,
  PROFILE_STATS,
  attributeValue,
  characterOf,
  maxResourcesFor,
  profileOf,
} from './profiles';
import {
  allOverwhelmed,
  approachKey,
  currentScene,
  markClosingIfNeeded,
  requirementSatisfied,
  resolveSceneResult,
  sceneThresholds,
  unlockVector,
} from './scenes';
import type {
  CheckBreakdown,
  EngineAction,
  EngineFailure,
  EngineResult,
  RulesErrorCode,
  SessionState,
} from './schemas';
import { REST_USED_FLAG, sessionStateSchema } from './schemas';
import {
  beginNextRound,
  markSeatVisited,
  nextUnvisitedSeat,
  resetAllPassRound,
} from './turns';

export {
  ABILITY_COST,
  ABILITY_MODIFIER,
  MAX_DIE,
  MIN_DIE,
  PROFILE_STATS,
  attributeValue,
} from './profiles';
export { clamp } from './effects';
export { endingKind, sceneThresholds } from './scenes';

export function rollD20(): number {
  return randomInt(MIN_DIE, MAX_DIE + 1);
}

export function sumConditionModifiers(modifiers: number[]): number {
  return clamp(
    modifiers.reduce((sum, value) => sum + value, 0),
    -2,
    2,
  );
}

export function conditionModifierFor(
  member: SessionState['party'][number],
  attribute: Attribute,
): number {
  const modifiers: number[] = [];
  for (const condition of member.conditions) {
    if (condition.id === 'focused') modifiers.push(1);
    if (condition.id === 'shaken' && attribute === 'presence') modifiers.push(-1);
    if (condition.id === 'exposed' && attribute === 'agility') modifiers.push(-1);
  }
  return sumConditionModifiers(modifiers);
}

export function computeCheck(input: {
  die: number;
  attributeValue: number;
  conditionModifier: number;
  abilityUsed: boolean;
  target: Difficulty;
}): Omit<CheckBreakdown, 'actorId' | 'attribute'> {
  const conditionModifier = clamp(input.conditionModifier, -2, 2);
  const abilityModifier = input.abilityUsed ? ABILITY_MODIFIER : 0;
  const total = input.die + input.attributeValue + conditionModifier + abilityModifier;
  const outcome =
    total >= input.target
      ? 'success'
      : total >= input.target - 3
        ? 'partial'
        : 'failure';
  return {
    die: input.die,
    attributeValue: input.attributeValue,
    conditionModifier,
    abilityModifier,
    target: input.target,
    total,
    outcome,
  };
}

export function stakesFor(
  risk: ApproachDefinition['risk'],
  locale: Locale,
): { success: string; partial: string; failure: string } {
  const table = locale === 'zh-Hant' ? zhHant : en;
  return {
    success: table[`stakes.${risk}.success`],
    partial: table[`stakes.${risk}.partial`],
    failure: table[`stakes.${risk}.failure`],
  };
}

function fail(code: RulesErrorCode): EngineFailure {
  return { ok: false, code };
}

function partyMember(state: SessionState, actorId: string) {
  return state.party.find((member) => member.playerId === actorId);
}

function isOverwhelmed(member: SessionState['party'][number]): boolean {
  return member.hp === 0;
}

function itemQuantity(state: SessionState, itemId: string): number {
  return state.inventory
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function approachAvailable(
  state: SessionState,
  approach: ApproachDefinition,
): boolean {
  if (!requirementSatisfied(state, approach.requires)) {
    return false;
  }
  const key = approachKey(approach.obstacleId, approach.methodVariantId);
  const failed = state.scene.failedApproaches.find((entry) => entry.key === key);
  if (!failed) {
    return true;
  }
  const before = JSON.parse(failed.prerequisiteFingerprint) as boolean[];
  const now = unlockVector(state, approach.retryUnlockedBy);
  return now.some((value, index) => value && before[index] === false);
}

function sceneResultOf(
  before: SessionState,
  after: SessionState,
): 'cleared' | 'setback' | null {
  if (after.scene.index === before.scene.index && after.status === 'active') {
    return null;
  }
  return after.sceneResults.at(-1)?.result ?? null;
}

function setPromptFromScene(
  state: SessionState,
  pack: WorldPack,
): SessionState {
  const next = structuredClone(state);
  const scene = currentScene(pack, next);
  next.currentPrompt = scene.prompt[next.locale];
  next.suggestions = scene.suggestions.map((suggestion) => ({
    text: suggestion.text[next.locale],
    approachId: suggestion.approachId,
  }));
  return next;
}

function afterMeaningfulAction(
  state: SessionState,
  pack: WorldPack,
  seat: number,
  options: { pass: boolean },
): SessionState {
  let next = markSeatVisited(state, seat);
  if (!options.pass) {
    next.turn.meaningfulActionsThisRound += 1;
  }
  next.committedActionCount += 1;
  const remaining = nextUnvisitedSeat(next);
  if (remaining !== null) {
    next.turn.activeSeat = remaining;
    return setPromptFromScene(next, pack);
  }

  const thresholds = sceneThresholds(next.party.length);
  if (allOverwhelmed(next)) {
    return resolveSceneResult(next, pack, 'setback');
  }
  if (next.scene.closingReason) {
    return resolveSceneResult(next, pack, next.scene.closingReason);
  }
  if (next.turn.meaningfulActionsThisRound === 0) {
    next = resetAllPassRound(next);
    return setPromptFromScene(next, pack);
  }

  next.scene.resolvedRounds += 1;
  if (next.scene.resolvedRounds >= thresholds.maxResolvedRounds) {
    return resolveSceneResult(next, pack, 'setback');
  }
  next = beginNextRound(next);
  return setPromptFromScene(next, pack);
}

export function createInitialState(input: {
  worldId?: string;
  locale: Locale;
  players: Array<{
    playerId: string;
    displayName: string;
    characterId: string;
  }>;
}, pack: WorldPack): SessionState {
  if (input.players.length < 1 || input.players.length > 4) {
    throw new Error('Party must have 1–4 players');
  }
  const characterIds = new Set(input.players.map((player) => player.characterId));
  if (characterIds.size !== input.players.length) {
    throw new Error('Players must select different characters');
  }

  const party = input.players.map((player, seat) => {
    const character = characterOf(pack, player.characterId);
    const stats = PROFILE_STATS[character.profile];
    return {
      playerId: player.playerId,
      seat,
      displayName: player.displayName,
      characterId: player.characterId,
      hp: stats.hp,
      mp: stats.mp,
      conditions: [],
    };
  });

  const restorativeCount = Math.ceil(party.length / 2);
  const inventory = [
    {
      itemId: pack.restorativeItemId,
      quantity: restorativeCount,
      ownerId: null,
    },
    {
      itemId: pack.focusDraughtItemId,
      quantity: 1,
      ownerId: null,
    },
    ...party.map((member) => ({
      itemId: characterOf(pack, member.characterId).startingItemId,
      quantity: 1,
      ownerId: member.playerId,
    })),
  ];

  const firstProfile = profileOf(pack, party[0].characterId);
  const opening = pack.openingByProfile[firstProfile];
  const scene = pack.scenes[0];
  const state: SessionState = {
    schemaVersion: 1,
    worldId: input.worldId ?? pack.id,
    contentVersion: 1,
    locale: input.locale,
    status: 'active',
    party,
    turn: {
      activeSeat: 0,
      round: 1,
      visitedSeats: [],
      meaningfulActionsThisRound: 0,
    },
    scene: {
      index: 0,
      challengeId: scene.challengeId,
      progress: 0,
      threat: 0,
      resolvedRounds: 0,
      closingReason: null,
      failedApproaches: [],
    },
    inventory,
    npcTrust: Object.fromEntries(pack.npcs.map((npc) => [npc.id, 0])),
    flags: [],
    revealedFactIds: [...scene.publicFactsOnEntry],
    routeChoiceId: null,
    cleanSceneCount: 0,
    committedActionCount: 0,
    sceneResults: [],
    publicJournal: [],
    currentPrompt: opening.prompt[input.locale],
    suggestions: opening.suggestions.map((suggestion) => ({
      text: suggestion.text[input.locale],
      approachId: suggestion.approachId,
    })),
    ending: null,
  };
  return sessionStateSchema.parse(state);
}

function assertActiveActor(
  state: SessionState,
  actorId: string,
): EngineResult | SessionState['party'][number] {
  if (state.status !== 'active') {
    return fail('SESSION_ENDED');
  }
  const actor = partyMember(state, actorId);
  if (!actor) {
    return fail('INVALID_TARGET');
  }
  if (actor.seat !== state.turn.activeSeat) {
    return fail('INVALID_TARGET');
  }
  return actor;
}

export function resolveAction(
  state: SessionState,
  pack: WorldPack,
  action: EngineAction,
  rollD20Fn: () => number = rollD20,
): EngineResult {
  const actorOrError = assertActiveActor(state, action.actorId);
  if (!('playerId' in actorOrError)) {
    return actorOrError;
  }
  const actor = actorOrError;
  const scene = currentScene(pack, state);

  if (action.kind === 'question' || action.kind === 'clarify' || action.kind === 'impossible') {
    return {
      ok: true,
      state,
      check: null,
      consumedTurn: false,
      sceneResult: null,
    };
  }

  if (action.kind === 'pass') {
    const next = afterMeaningfulAction(state, pack, actor.seat, { pass: true });
    return {
      ok: true,
      state: next,
      check: null,
      consumedTurn: true,
      sceneResult: sceneResultOf(state, next),
    };
  }

  if (action.kind === 'automatic') {
    if (isOverwhelmed(actor)) {
      return fail('INVALID_INPUT');
    }
    const next = afterMeaningfulAction(state, pack, actor.seat, { pass: false });
    return {
      ok: true,
      state: next,
      check: null,
      consumedTurn: true,
      sceneResult: sceneResultOf(state, next),
    };
  }

  if (action.kind === 'help') {
    if (isOverwhelmed(actor)) {
      return fail('INVALID_INPUT');
    }
    const target = partyMember(state, action.targetPlayerId);
    if (!target || target.playerId === actor.playerId || target.hp !== 0) {
      return fail('INVALID_TARGET');
    }
    let next = structuredClone(state);
    const draft = next.party.find((member) => member.playerId === target.playerId);
    if (!draft) {
      return fail('INVALID_TARGET');
    }
    draft.hp = 3;
    next = afterMeaningfulAction(next, pack, actor.seat, { pass: false });
    return {
      ok: true,
      state: next,
      check: null,
      consumedTurn: true,
      sceneResult: sceneResultOf(state, next),
    };
  }

  if (action.kind === 'use_item') {
    const target = partyMember(state, action.targetPlayerId);
    if (!target) {
      return fail('INVALID_TARGET');
    }
    const definition = pack.items.find((item) => item.id === action.itemId);
    if (!definition || (definition.kind !== 'restorative' && definition.kind !== 'focus-draught')) {
      return fail('INVALID_INPUT');
    }
    if (itemQuantity(state, action.itemId) < 1) {
      return fail('INVALID_INPUT');
    }
    if (isOverwhelmed(actor) && definition.kind !== 'restorative') {
      return fail('INVALID_INPUT');
    }
    const profile = profileOf(pack, target.characterId);
    const max = maxResourcesFor(profile);
    if (definition.kind === 'restorative' && target.hp >= max.hp) {
      return fail('INVALID_INPUT');
    }
    if (definition.kind === 'focus-draught' && target.mp >= max.mp) {
      return fail('INVALID_INPUT');
    }
    const effects: Effect[] = [
      { type: 'consume_item', itemId: action.itemId },
      definition.kind === 'restorative'
        ? { type: 'restore', playerId: target.playerId, resource: 'hp', amount: 4 }
        : { type: 'restore', playerId: target.playerId, resource: 'mp', amount: 3 },
    ];
    if (!validateEffects(state, pack, effects)) {
      return fail('INVALID_INPUT');
    }
    let next = applyEffects(state, pack, effects);
    next = afterMeaningfulAction(next, pack, actor.seat, { pass: false });
    return {
      ok: true,
      state: next,
      check: null,
      consumedTurn: true,
      sceneResult: sceneResultOf(state, next),
    };
  }

  if (action.kind === 'rest') {
    if (!scene.restAllowed || scene.index !== 3) {
      return fail('INVALID_INPUT');
    }
    if (state.flags.includes(REST_USED_FLAG)) {
      return fail('INVALID_INPUT');
    }
    if (isOverwhelmed(actor)) {
      return fail('INVALID_INPUT');
    }
    const effects: Effect[] = [
      { type: 'set_flag', flagId: REST_USED_FLAG },
      ...state.party.flatMap((member) => [
        { type: 'restore' as const, playerId: member.playerId, resource: 'hp' as const, amount: 3 },
        { type: 'restore' as const, playerId: member.playerId, resource: 'mp' as const, amount: 2 },
      ]),
    ];
    if (!validateEffects(state, pack, effects)) {
      return fail('INVALID_INPUT');
    }
    let next = applyEffects(state, pack, effects);
    next = afterMeaningfulAction(next, pack, actor.seat, { pass: false });
    return {
      ok: true,
      state: next,
      check: null,
      consumedTurn: true,
      sceneResult: sceneResultOf(state, next),
    };
  }

  if (action.kind !== 'check') {
    return fail('INVALID_INPUT');
  }

  if (isOverwhelmed(actor)) {
    return fail('INVALID_INPUT');
  }
  if (state.scene.closingReason) {
    return fail('INVALID_INPUT');
  }

  const approach = scene.approaches.find((entry) => entry.id === action.approachId);
  if (!approach) {
    return fail('INVALID_INPUT');
  }
  if (approach.risk === 'trust' && !approach.npcId) {
    return fail('INVALID_INPUT');
  }
  if (!approachAvailable(state, approach)) {
    return fail('REPEAT_APPROACH');
  }

  const profile = profileOf(pack, actor.characterId);
  const stats = PROFILE_STATS[profile];
  if (action.useAbility) {
    if (stats.abilityAttribute !== approach.attribute) {
      return fail('ABILITY_NOT_APPLICABLE');
    }
    if (actor.mp < ABILITY_COST) {
      return fail('INSUFFICIENT_MP');
    }
  }

  const die = rollD20Fn();
  const check = computeCheck({
    die,
    attributeValue: attributeValue(profile, approach.attribute),
    conditionModifier: conditionModifierFor(actor, approach.attribute),
    abilityUsed: Boolean(action.useAbility),
    target: approach.target,
  });
  const breakdown: CheckBreakdown = {
    actorId: actor.playerId,
    attribute: approach.attribute,
    ...check,
  };

  const effects: Effect[] = [];
  if (action.useAbility) {
    effects.push({
      type: 'damage',
      playerId: actor.playerId,
      resource: 'mp',
      amount: ABILITY_COST,
    });
  }
  if (actor.conditions.some((condition) => condition.id === 'focused')) {
    effects.push({
      type: 'remove_condition',
      playerId: actor.playerId,
      conditionId: 'focused',
    });
  }
  effects.push(
    ...riskEffects(approach.risk, check.outcome, actor.playerId, approach.npcId),
  );
  const story =
    check.outcome === 'success'
      ? approach.successEffects
      : check.outcome === 'partial'
        ? approach.partialEffects
        : approach.failureEffects;
  for (const storyEffect of story) {
    if (storyEffect.type === 'apply_condition') {
      effects.push({
        type: 'apply_condition',
        playerId: actor.playerId,
        conditionId: storyEffect.conditionId,
      });
    } else {
      effects.push(storyEffect);
    }
  }

  if (!validateEffects(state, pack, effects)) {
    return fail('INVALID_INPUT');
  }

  let next = applyEffects(state, pack, effects);
  if (
    check.outcome === 'failure'
  ) {
    const key = approachKey(approach.obstacleId, approach.methodVariantId);
    next.scene.failedApproaches = [
      ...next.scene.failedApproaches.filter((entry) => entry.key !== key),
      {
        key,
        prerequisiteFingerprint: JSON.stringify(
          unlockVector(state, approach.retryUnlockedBy),
        ),
      },
    ];
  }
  if (
    (check.outcome === 'success' || check.outcome === 'partial') &&
    approach.choiceId &&
    scene.index === 6
  ) {
    next.routeChoiceId = approach.choiceId;
  }

  next = markClosingIfNeeded(next);

  const availableChecks = currentScene(pack, next).approaches.filter((entry) =>
    next.scene.closingReason ? false : approachAvailable(next, entry),
  );
  if (!next.scene.closingReason && availableChecks.length === 0) {
    next.scene.closingReason = 'setback';
  }

  if (allOverwhelmed(next)) {
    next.committedActionCount += 1;
    next = resolveSceneResult(next, pack, 'setback');
    return {
      ok: true,
      state: next,
      check: breakdown,
      consumedTurn: true,
      sceneResult: 'setback',
    };
  }

  next = afterMeaningfulAction(next, pack, actor.seat, { pass: false });
  return {
    ok: true,
    state: next,
    check: breakdown,
    consumedTurn: true,
    sceneResult: sceneResultOf(state, next),
  };
}
