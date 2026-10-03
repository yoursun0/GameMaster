import type { Requirement, WorldPack } from '@/server/content/types';
import type { Locale } from '@/shared/schemas';
import type { EndingKind } from '@/shared/schemas';
import { PROFILE_STATS, maxResourcesFor, profileOf } from './profiles';
import type { SessionState } from './schemas';
import { REST_USED_FLAG } from './schemas';

export function sceneThresholds(playerCount: number): {
  progressTarget: number;
  threatLimit: number;
  maxResolvedRounds: number;
} {
  return {
    progressTarget: Math.max(2, playerCount),
    threatLimit: Math.max(2, playerCount),
    maxResolvedRounds: 2,
  };
}

export function endingKind(
  cleanSceneCount: number,
  finalResult: 'cleared' | 'setback',
): EndingKind {
  if (finalResult === 'cleared' && cleanSceneCount >= 5) return 'success';
  if (finalResult === 'cleared') return 'compromise';
  if (cleanSceneCount >= 4) return 'compromise';
  return 'failure';
}

export function allDown(state: SessionState): boolean {
  return state.party.length > 0 && state.party.every((member) => member.hp <= 0);
}

/** The whole party is down: set each to 1 HP and leave this place as a setback. */
export function recoverWipe(state: SessionState, pack: WorldPack): SessionState {
  const next = structuredClone(state);
  for (const member of next.party) {
    if (member.hp <= 0) member.hp = 1;
  }
  if (next.status !== 'active') return next;
  if (next.scene.closingReason) {
    return resolveSceneResult(next, pack, next.scene.closingReason);
  }
  return resolveSceneResult(next, pack, 'setback');
}

export function requirementSatisfied(
  state: SessionState,
  requirement: Requirement,
): boolean {
  if (requirement.allFlags?.some((flag) => !state.flags.includes(flag))) {
    return false;
  }
  if (
    requirement.revealedFacts?.some((factId) => !state.revealedFactIds.includes(factId))
  ) {
    return false;
  }
  if (requirement.itemId) {
    const owned = state.inventory.some(
      (item) => item.itemId === requirement.itemId && item.quantity > 0,
    );
    if (!owned) return false;
  }
  if (requirement.minimumTrust) {
    const trust = state.npcTrust[requirement.minimumTrust.npcId] ?? 0;
    if (trust < requirement.minimumTrust.value) return false;
  }
  return true;
}

export function unlockVector(
  state: SessionState,
  requirements: Requirement[],
): boolean[] {
  return requirements.map((requirement) => requirementSatisfied(state, requirement));
}

export function approachKey(obstacleId: string, methodVariantId: string): string {
  return `${obstacleId}:${methodVariantId}`;
}

export function currentScene(pack: WorldPack, state: SessionState) {
  const scene = pack.scenes.find((entry) => entry.index === state.scene.index);
  if (!scene) {
    throw new Error(`Missing scene ${state.scene.index}`);
  }
  return scene;
}

const SEAT_JOB: Record<string, { en: string; 'zh-Hant': string }> = {
  might: { en: 'The door and the blade are yours.', 'zh-Hant': '門和刀是你的。' },
  agility: { en: 'The way out is yours.', 'zh-Hant': '出路是你的。' },
  insight: { en: 'The seal and the page are yours.', 'zh-Hant': '封蠟和書頁是你的。' },
  presence: { en: 'The voices in this room are yours.', 'zh-Hant': '這屋子裡的話是你的。' },
};

export function orderSuggestionsForSeat(
  pack: WorldPack,
  state: SessionState,
  suggestions: SessionState['suggestions'],
): SessionState['suggestions'] {
  const actor = state.party[state.turn.activeSeat];
  if (!actor) return suggestions;
  const attribute = PROFILE_STATS[profileOf(pack, actor.characterId)].abilityAttribute;
  const rank = (approachId: string | null) => (approachId?.endsWith(`-${attribute}`) ? 0 : 1);
  return [...suggestions].sort((a, b) => rank(a.approachId) - rank(b.approachId));
}

export function seatJob(pack: WorldPack, state: SessionState): string {
  const actor = state.party[state.turn.activeSeat];
  if (!actor) return '';
  const attribute = PROFILE_STATS[profileOf(pack, actor.characterId)].abilityAttribute;
  const line = SEAT_JOB[attribute]?.[state.locale] ?? '';
  if (!line) return actor.displayName;
  const sep = state.locale === 'zh-Hant' ? '，' : ', ';
  return `${actor.displayName}${sep}${line}`;
}

function localizePrompt(
  pack: WorldPack,
  state: SessionState,
  locale: Locale,
): { currentPrompt: string; suggestions: SessionState['suggestions'] } {
  const scene = currentScene(pack, state);
  const actor = state.party[state.turn.activeSeat];
  const profile = actor ? profileOf(pack, actor.characterId) : 'guardian';
  const job = seatJob(pack, state);
  if (state.scene.index === 0 && state.committedActionCount === 0) {
    const opening = pack.openingByProfile[profile];
    return {
      currentPrompt: `${job} ${opening.prompt[locale]}`.trim(),
      suggestions: orderSuggestionsForSeat(
        pack,
        state,
        opening.suggestions.map((suggestion) => ({
          text: suggestion.text[locale],
          approachId: suggestion.approachId,
        })),
      ),
    };
  }
  return {
    currentPrompt: `${job} ${scene.prompt[locale]}`.trim(),
    suggestions: orderSuggestionsForSeat(
      pack,
      state,
      scene.suggestions.map((suggestion) => ({
        text: suggestion.text[locale],
        approachId: suggestion.approachId,
      })),
    ),
  };
}

export function applySceneRecovery(state: SessionState, pack: WorldPack): SessionState {
  const next = structuredClone(state);
  next.flags = next.flags.filter((flag) => flag !== REST_USED_FLAG);
  for (const member of next.party) {
    member.conditions = [];
    if (member.hp === 0) {
      member.hp = 3;
    }
    const max = maxResourcesFor(profileOf(pack, member.characterId));
    member.hp = Math.min(member.hp, max.hp);
  }
  return next;
}

function revealOnTransition(
  state: SessionState,
  pack: WorldPack,
  fromIndex: number,
  nextIndex: number | null,
): SessionState {
  const next = structuredClone(state);
  const from = pack.scenes[fromIndex];
  for (const factId of from.factsRequiredForNextScene) {
    if (!next.revealedFactIds.includes(factId)) {
      next.revealedFactIds.push(factId);
    }
  }
  if (nextIndex !== null) {
    const incoming = pack.scenes[nextIndex];
    for (const factId of incoming.publicFactsOnEntry) {
      if (!next.revealedFactIds.includes(factId)) {
        next.revealedFactIds.push(factId);
      }
    }
  }
  return next;
}

export function markClosingIfNeeded(state: SessionState): SessionState {
  if (state.scene.closingReason) {
    return state;
  }
  const next = structuredClone(state);
  const thresholds = sceneThresholds(next.party.length);
  const hitThreat = next.scene.threat >= thresholds.threatLimit;
  const hitProgress = next.scene.progress >= thresholds.progressTarget;
  if (hitThreat) {
    next.scene.closingReason = 'setback';
  } else if (hitProgress) {
    next.scene.closingReason = 'cleared';
  }
  return next;
}

export function resolveSceneResult(
  state: SessionState,
  pack: WorldPack,
  result: 'cleared' | 'setback',
): SessionState {
  const locale = state.locale;
  const from = currentScene(pack, state);
  let next = structuredClone(state);
  if (from.index === 6 && !next.routeChoiceId) {
    next.routeChoiceId = pack.defaultRouteId;
  }
  const choiceIds =
    from.index === 6 && next.routeChoiceId ? [next.routeChoiceId] : [];
  next.sceneResults.push({
    sceneId: from.id,
    result,
    choiceIds,
  });
  if (result === 'cleared') {
    next.cleanSceneCount += 1;
  }

  next = revealOnTransition(
    next,
    pack,
    from.index,
    from.index < 7 ? from.index + 1 : null,
  );

  if (from.index >= 7) {
    const kind = endingKind(next.cleanSceneCount, result);
    const routeId = next.routeChoiceId ?? pack.defaultRouteId;
    const variant = pack.endingVariants.find(
      (entry) => entry.routeId === routeId && entry.kind === kind,
    );
    if (!variant) {
      throw new Error(`Missing ending variant ${routeId}/${kind}`);
    }
    next.status = 'completed';
    next.currentPrompt = '';
    next.suggestions = [];
    next.ending = {
      kind,
      summary: variant.summary[locale],
      epilogues: next.party.map((member) => {
        const epilogue = variant.epilogues.find(
          (entry) => entry.characterId === member.characterId,
        );
        return {
          playerId: member.playerId,
          text: epilogue?.text[locale] ?? '',
        };
      }),
    };
    next = applySceneRecovery(next, pack);
    return next;
  }

  const following = pack.scenes[from.index + 1];
  next.scene = {
    index: following.index,
    challengeId: following.challengeId,
    progress: 0,
    threat: 0,
    resolvedRounds: 0,
    closingReason: null,
    failedApproaches: [],
  };
  next.turn = {
    activeSeat: 0,
    round: 1,
    visitedSeats: [],
    meaningfulActionsThisRound: 0,
  };
  next = applySceneRecovery(next, pack);
  const prompt = localizePrompt(pack, next, locale);
  next.currentPrompt = prompt.currentPrompt;
  next.suggestions = prompt.suggestions;
  return next;
}
