import { ATTRIBUTES, PROFILES, WORLD_IDS } from '@/shared/schemas';
import type { Profile } from '@/shared/schemas';
import { REST_USED_FLAG } from '@/server/game/schemas';
import type { ContentIssue, WorldPack } from './types';
import { hasBothLocales } from './types';

export class ContentValidationError extends Error {
  constructor(public readonly issues: ContentIssue[]) {
    super(
      issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'),
    );
    this.name = 'ContentValidationError';
  }
}

function actForIndex(index: number): 1 | 2 | 3 {
  if (index <= 1) return 1;
  if (index <= 5) return 2;
  return 3;
}

function issue(path: string, message: string): ContentIssue {
  return { path, message };
}

function packIssue(pack: WorldPack, path: string, message: string): ContentIssue {
  return issue(`${pack.id}/${path}`, message);
}

export function collectWorldPackIssues(
  pack: WorldPack,
  options: { requireCanonicalId?: boolean } = {},
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const tagged = (path: string, message: string) => packIssue(pack, path, message);
  const requireCanonicalId = options.requireCanonicalId ?? pack.id !== 'test-campaign';

  if (requireCanonicalId && !WORLD_IDS.includes(pack.id as (typeof WORLD_IDS)[number])) {
    issues.push(tagged('id', `World id must be one of ${WORLD_IDS.join(', ')}`));
  }
  if (pack.contentVersion !== 1) {
    issues.push(tagged('contentVersion', 'contentVersion must be 1'));
  }
  for (const [path, value] of [
    ['title', pack.title],
    ['premise', pack.premise],
    ['tone', pack.tone],
    ['resourceLabels.hp', pack.resourceLabels.hp],
    ['resourceLabels.mp', pack.resourceLabels.mp],
  ] as const) {
    if (!hasBothLocales(value)) {
      issues.push(tagged(path, 'Missing English or Traditional Chinese text'));
    }
  }

  if (pack.characters.length !== 4) {
    issues.push(tagged('characters', 'Exactly four characters are required'));
  }
  const profiles = pack.characters.map((character) => character.profile);
  for (const profile of PROFILES) {
    if (profiles.filter((entry) => entry === profile).length !== 1) {
      issues.push(tagged('characters', `Exactly one ${profile} is required`));
    }
  }
  const characterIds = new Set<string>();
  for (const [index, character] of pack.characters.entries()) {
    const path = `characters[${index}]`;
    if (characterIds.has(character.id)) {
      issues.push(tagged(`${path}.id`, 'Duplicate character id'));
    }
    characterIds.add(character.id);
    for (const [field, value] of [
      ['name', character.name],
      ['role', character.role],
      ['biography', character.biography],
      ['motivation', character.motivation],
      ['connection', character.connection],
      ['ability.name', character.ability.name],
      ['ability.description', character.ability.description],
    ] as const) {
      if (!hasBothLocales(value)) {
        issues.push(tagged(`${path}.${field}`, 'Missing locale text'));
      }
    }
    if (!pack.items.some((item) => item.id === character.startingItemId)) {
      issues.push(tagged(`${path}.startingItemId`, 'Unknown starting item'));
    }
  }

  if (pack.npcs.length !== 3) {
    issues.push(tagged('npcs', 'Exactly three NPCs are required'));
  }
  const npcIds = new Set(pack.npcs.map((npc) => npc.id));
  if (npcIds.size !== pack.npcs.length) {
    issues.push(tagged('npcs', 'NPC ids must be unique'));
  }

  const itemIds = new Set(pack.items.map((item) => item.id));
  if (!itemIds.has(pack.restorativeItemId)) {
    issues.push(tagged('restorativeItemId', 'Unknown restorative item'));
  }
  if (!itemIds.has(pack.focusDraughtItemId)) {
    issues.push(tagged('focusDraughtItemId', 'Unknown focus-draught item'));
  }
  const restorative = pack.items.find((item) => item.id === pack.restorativeItemId);
  if (restorative && restorative.kind !== 'restorative') {
    issues.push(tagged('restorativeItemId', 'Item kind must be restorative'));
  }
  const draught = pack.items.find((item) => item.id === pack.focusDraughtItemId);
  if (draught && draught.kind !== 'focus-draught') {
    issues.push(tagged('focusDraughtItemId', 'Item kind must be focus-draught'));
  }

  const factIds = new Set(pack.facts.map((fact) => fact.id));
  if (factIds.size !== pack.facts.length) {
    issues.push(tagged('facts', 'Fact ids must be unique'));
  }
  if (!pack.flags.includes(REST_USED_FLAG)) {
    issues.push(tagged('flags', `Must declare ${REST_USED_FLAG}`));
  }

  if (pack.scenes.length !== 8) {
    issues.push(tagged('scenes', 'Exactly eight scenes are required'));
  }
  const restScenes = pack.scenes.filter((scene) => scene.restAllowed);
  if (restScenes.length !== 1 || restScenes[0]?.index !== 3) {
    issues.push(tagged('scenes', 'Exactly one rest scene is required at index 3'));
  }

  const routeIds = new Set<string>();
  for (const [index, scene] of pack.scenes.entries()) {
    const path = `scenes[${index}]`;
    if (scene.index !== index) {
      issues.push(tagged(`${path}.index`, 'Scenes must be consecutive from 0'));
    }
    if (scene.act !== actForIndex(scene.index)) {
      issues.push(tagged(`${path}.act`, `Expected act ${actForIndex(scene.index)}`));
    }
    for (const [field, value] of [
      ['title', scene.title],
      ['location', scene.location],
      ['opening', scene.opening],
      ['objective', scene.objective],
      ['prompt', scene.prompt],
      ['clearedTransition', scene.clearedTransition],
      ['setbackTransition', scene.setbackTransition],
    ] as const) {
      if (!hasBothLocales(value)) {
        issues.push(tagged(`${path}.${field}`, 'Missing locale text'));
      }
    }
    if (scene.suggestions.length < 2 || scene.suggestions.length > 3) {
      issues.push(tagged(`${path}.suggestions`, 'Need 2–3 suggestions'));
    }
    const usableByAttribute = new Set<string>();
    let hasStandardPath = false;
    for (const [approachIndex, approach] of scene.approaches.entries()) {
      const approachPath = `${path}.approaches[${approachIndex}]`;
      if (approach.risk === 'trust' && !approach.npcId) {
        issues.push(tagged(`${approachPath}.npcId`, 'Trust approaches need npcId'));
      }
      if (approach.npcId && !npcIds.has(approach.npcId)) {
        issues.push(tagged(`${approachPath}.npcId`, 'Unknown NPC'));
      }
      if (scene.index === 6) {
        if (!approach.choiceId) {
          issues.push(tagged(`${approachPath}.choiceId`, 'Scene 6 needs a route choice'));
        } else {
          routeIds.add(approach.choiceId);
        }
      }
      const emptyRequires =
        !approach.requires.allFlags?.length &&
        !approach.requires.revealedFacts?.length &&
        !approach.requires.itemId &&
        !approach.requires.minimumTrust;
      if (emptyRequires) {
        usableByAttribute.add(approach.attribute);
      }
      if (approach.target === 8 || approach.target === 12) {
        hasStandardPath = true;
      }
      for (const [listName, list] of [
        ['successEffects', approach.successEffects],
        ['partialEffects', approach.partialEffects],
        ['failureEffects', approach.failureEffects],
      ] as const) {
        if (list.length > 3) {
          issues.push(tagged(`${approachPath}.${listName}`, 'At most three story effects'));
        }
        const items = list.filter((effect) => effect.type === 'grant_item');
        const conditions = list.filter((effect) => effect.type === 'apply_condition');
        if (items.length > 1 || conditions.length > 1) {
          issues.push(
            tagged(`${approachPath}.${listName}`, 'At most one item and one condition'),
          );
        }
        for (const effect of list) {
          if (effect.type === 'set_flag' && !pack.flags.includes(effect.flagId)) {
            issues.push(tagged(`${approachPath}.${listName}`, `Unknown flag ${effect.flagId}`));
          }
          if (effect.type === 'reveal_fact' && !factIds.has(effect.factId)) {
            issues.push(tagged(`${approachPath}.${listName}`, `Unknown fact ${effect.factId}`));
          }
          if (effect.type === 'grant_item' && !itemIds.has(effect.itemId)) {
            issues.push(tagged(`${approachPath}.${listName}`, `Unknown item ${effect.itemId}`));
          }
        }
      }
    }
    for (const attribute of ATTRIBUTES) {
      if (!usableByAttribute.has(attribute)) {
        issues.push(tagged(`${path}.approaches`, `Missing initially usable ${attribute}`));
      }
    }
    if (!hasStandardPath) {
      issues.push(tagged(`${path}.approaches`, 'Need an easy or standard path'));
    }
    for (const npcId of scene.availableNpcIds) {
      if (!npcIds.has(npcId)) {
        issues.push(tagged(`${path}.availableNpcIds`, `Unknown NPC ${npcId}`));
      }
    }
    for (const factId of scene.publicFactsOnEntry) {
      if (!factIds.has(factId)) {
        issues.push(tagged(`${path}.publicFactsOnEntry`, `Unknown fact ${factId}`));
      }
      const fact = pack.facts.find((entry) => entry.id === factId);
      if (fact?.secret && scene.index === 0) {
        issues.push(tagged(`${path}.publicFactsOnEntry`, 'Secret fact exposed at start'));
      }
    }
    for (const factId of scene.factsRequiredForNextScene) {
      const fact = pack.facts.find((entry) => entry.id === factId);
      if (!fact) {
        issues.push(tagged(`${path}.factsRequiredForNextScene`, `Unknown fact ${factId}`));
        continue;
      }
      if (fact.revealGate?.on !== 'either' || fact.revealGate.sceneId !== scene.id) {
        issues.push(
          tagged(
            `${path}.factsRequiredForNextScene`,
            `${factId} must be releasable on both clear and setback`,
          ),
        );
      }
    }
  }

  if (pack.scenes.length === 8) {
    const scene6 = pack.scenes[6];
    if (routeIds.size !== 2) {
      issues.push(tagged('scenes[6]', 'Exactly two major route ids are required'));
    }
    if (pack.defaultRouteId && !routeIds.has(pack.defaultRouteId) && routeIds.size === 2) {
      issues.push(tagged('defaultRouteId', 'Default route must be one of the scene-6 routes'));
    }
    const attributesByRoute = new Map<string, Set<string>>();
    for (const approach of scene6?.approaches ?? []) {
      if (!approach.choiceId) continue;
      const set = attributesByRoute.get(approach.choiceId) ?? new Set();
      set.add(approach.attribute);
      attributesByRoute.set(approach.choiceId, set);
    }
    for (const [routeId, attributes] of attributesByRoute) {
      if (attributes.size < 2) {
        issues.push(tagged('scenes[6]', `Route ${routeId} needs at least two attributes`));
      }
    }
    const kinds = ['success', 'compromise', 'failure'] as const;
    for (const routeId of routeIds) {
      for (const kind of kinds) {
        const variant = pack.endingVariants.find(
          (entry) => entry.routeId === routeId && entry.kind === kind,
        );
        if (!variant) {
          issues.push(tagged('endingVariants', `Missing ${routeId}/${kind}`));
          continue;
        }
        if (!hasBothLocales(variant.summary)) {
          issues.push(tagged('endingVariants.summary', 'Missing locale text'));
        }
        for (const character of pack.characters) {
          const epilogue = variant.epilogues.find(
            (entry) => entry.characterId === character.id,
          );
          if (!epilogue || !hasBothLocales(epilogue.text)) {
            issues.push(
              tagged(
                'endingVariants.epilogues',
                `Missing ${character.id} epilogue for ${routeId}/${kind}`,
              ),
            );
          }
        }
      }
    }
  }

  for (const profile of PROFILES) {
    const opening = pack.openingByProfile[profile as Profile];
    if (!opening) {
      issues.push(tagged(`openingByProfile.${profile}`, 'Missing opening'));
      continue;
    }
    if (!hasBothLocales(opening.prompt)) {
      issues.push(tagged(`openingByProfile.${profile}.prompt`, 'Missing locale text'));
    }
    if (opening.suggestions.length < 2 || opening.suggestions.length > 3) {
      issues.push(
        tagged(`openingByProfile.${profile}.suggestions`, 'Need 2–3 opening suggestions'),
      );
    }
  }

  return issues;
}

export function validateWorldPack(
  pack: WorldPack,
  options?: { requireCanonicalId?: boolean },
): void {
  const issues = collectWorldPackIssues(pack, options);
  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }
}

export function validateWorldPacks(packs: WorldPack[]): void {
  const issues: ContentIssue[] = [];
  if (packs.length === 0) {
    issues.push(issue('packs', 'No world packs registered'));
  }
  const ids = new Set<string>();
  for (const pack of packs) {
    if (ids.has(pack.id)) {
      issues.push(issue('packs', `Duplicate world id ${pack.id}`));
    }
    ids.add(pack.id);
    issues.push(...collectWorldPackIssues(pack, { requireCanonicalId: true }));
  }
  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }
}
