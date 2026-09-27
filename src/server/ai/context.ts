import 'server-only';

import type { WorldPack } from '@/server/content/types';
import type { MessageRow } from '@/server/db/repository';
import type { SessionState } from '@/server/game/schemas';
import { anyDown, currentScene } from '@/server/game/scenes';
import { isApproachAvailable } from '@/server/game/rules';
import { spineApproachId } from './steer';
import type { InterpretContext, NarrateContext } from './types';

const PROMPT_BUDGET = 24_000;

export function availableApproachIds(
  pack: WorldPack,
  state: SessionState,
): string[] {
  const scene = currentScene(pack, state);
  if (state.scene.closingReason) {
    return [];
  }
  return scene.approaches
    .filter((approach) => isApproachAvailable(state, approach))
    .map((approach) => approach.id);
}

function speakerName(party: SessionState['party'], actorId: unknown): string | undefined {
  if (typeof actorId !== 'string') return undefined;
  return party.find((member) => member.playerId === actorId)?.displayName;
}

function dialogueFromMessage(
  row: MessageRow,
  party: SessionState['party'],
): { kind: string; speaker?: string; text: string } | null {
  const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  if (row.kind === 'player' && typeof payload.text === 'string') {
    return { kind: 'player', speaker: speakerName(party, payload.actorId), text: payload.text };
  }
  if (row.kind === 'check' && typeof payload.attribute === 'string') {
    return {
      kind: 'check',
      speaker: speakerName(party, payload.actorId),
      text: `${payload.attribute} ${String(payload.outcome ?? '')}`.trim(),
    };
  }
  if (row.kind === 'gm' || row.kind === 'ending') {
    const paragraphs = payload.paragraphs;
    if (Array.isArray(paragraphs)) {
      return { kind: 'gm', text: paragraphs.filter((p) => typeof p === 'string').join(' ') };
    }
  }
  return null;
}

function identify(
  pack: WorldPack,
  member: SessionState['party'][number] | undefined,
  locale: SessionState['locale'],
) {
  if (!member) return undefined;
  const character = pack.characters.find((entry) => entry.id === member.characterId);
  return {
    playerId: member.playerId,
    name: member.displayName,
    role: character?.role[locale] ?? '',
  };
}

function publicParty(pack: WorldPack, state: SessionState, actorId: string) {
  return state.party.map((member) => ({
    ...identify(pack, member, state.locale)!,
    hp: member.hp,
    mp: member.mp,
    active: member.playerId === actorId,
  }));
}

export function buildInterpretContext(args: {
  pack: WorldPack;
  state: SessionState;
  actorId: string;
  text: string;
  useAbility: boolean;
  messages?: MessageRow[];
}): InterpretContext {
  const { pack, state } = args;
  const locale = state.locale;
  const scene = currentScene(pack, state);
  const ids = availableApproachIds(pack, state);
  const approaches = scene.approaches
    .filter((approach) => ids.includes(approach.id))
    .map((approach) => ({
      id: approach.id,
      label: approach.label[locale],
      attribute: approach.attribute,
    }));
  const context: InterpretContext = {
    locale,
    actorId: args.actorId,
    text: args.text,
    useAbility: args.useAbility,
    availableApproachIds: ids,
    worldTone: pack.tone[locale],
    scene: {
      id: scene.id,
      title: scene.title[locale],
      description: scene.opening[locale],
    },
    justActed: identify(pack, state.party.find((member) => member.playerId === args.actorId), locale),
    party: publicParty(pack, state, args.actorId),
    inventory: state.inventory.map((item) => ({
      itemId: item.itemId,
      name:
        pack.items.find((definition) => definition.id === item.itemId)?.name[locale] ??
        item.itemId,
      quantity: item.quantity,
    })),
    revealedFacts: state.revealedFactIds.flatMap((id) => {
      const fact = pack.facts.find((entry) => entry.id === id);
      if (!fact) return [];
      return [{ id: fact.id, text: fact.text[locale] }];
    }),
    journal: state.publicJournal.slice(-12).map((entry) => entry.text.slice(0, 240)),
    recentDialogue: trimDialogue(args.messages ?? [], state.party),
    approaches,
    objective: scene.objective[locale],
    spineApproachId: spineApproachId(ids) ?? undefined,
    exitOnClear: scene.clearedTransition[locale],
    exitOnSetback: scene.setbackTransition[locale],
  };
  return trimContext(context);
}

export function buildNarrateContext(args: {
  pack: WorldPack;
  before: SessionState;
  after: SessionState;
  actorId: string;
  text?: string;
  outcome: string;
  resolutionNote?: string;
  toll?: string;
  check?: NarrateContext['check'];
  messages?: MessageRow[];
}): NarrateContext {
  const locale = args.after.locale;
  const scene = currentScene(args.pack, args.after);
  const ids = availableApproachIds(args.pack, args.after);
  const newlyRevealed = args.after.revealedFactIds.filter(
    (id) => !args.before.revealedFactIds.includes(id),
  );
  const transitioned = args.after.scene.index !== args.before.scene.index;
  const context: NarrateContext = {
    locale,
    actorId: args.actorId,
    text: args.text,
    justActed: identify(
      args.pack,
      args.after.party.find((member) => member.playerId === args.actorId),
      locale,
    ),
    speakToNext: identify(args.pack, args.after.party[args.after.turn.activeSeat], locale) ?? null,
    outcome: args.outcome,
    resolutionNote: args.resolutionNote,
    toll: args.toll,
    objective: scene.objective[locale],
    exitOnClear: scene.clearedTransition[locale],
    exitOnSetback: scene.setbackTransition[locale],
    nextActorId: args.after.party[args.after.turn.activeSeat]?.playerId,
    availableApproachIds: ids,
    partyPlayerIds: args.after.party.map((member) => member.playerId),
    revealedFactIds: args.after.revealedFactIds,
    newlyRevealedFacts: newlyRevealed.flatMap((id) => {
      const fact = args.pack.facts.find((entry) => entry.id === id);
      if (!fact) return [];
      return [{ id: fact.id, text: fact.text[locale] }];
    }),
    check: args.check,
    resourceChanges: args.after.party.map((member) => {
      const before = args.before.party.find((entry) => entry.playerId === member.playerId);
      return {
        playerId: member.playerId,
        hp: member.hp - (before?.hp ?? member.hp),
        mp: member.mp - (before?.mp ?? member.mp),
      };
    }),
    sceneTransition: transitioned
      ? { nextId: scene.id, opening: scene.opening[locale] }
      : null,
    endingKind: anyDown(args.after) ? null : (args.after.ending?.kind ?? null),
    worldTone: args.pack.tone[locale],
    scene: {
      id: scene.id,
      title: scene.title[locale],
      description: scene.opening[locale],
    },
    party: publicParty(args.pack, args.after, args.actorId),
    inventory: args.after.inventory.map((item) => ({
      itemId: item.itemId,
      name:
        args.pack.items.find((definition) => definition.id === item.itemId)?.name[
          locale
        ] ?? item.itemId,
      quantity: item.quantity,
    })),
    revealedFacts: args.after.revealedFactIds.flatMap((id) => {
      const fact = args.pack.facts.find((entry) => entry.id === id);
      if (!fact) return [];
      return [{ id: fact.id, text: fact.text[locale] }];
    }),
    journal: args.after.publicJournal.slice(-12).map((entry) => entry.text.slice(0, 240)),
    recentDialogue: trimDialogue(args.messages ?? [], args.after.party),
  };
  return trimContext(context);
}

export function interpretUserPayload(context: InterpretContext): string {
  return JSON.stringify({
    task: 'interpret',
    locale: context.locale,
    untrustedPlayerText: context.text,
    useAbility: context.useAbility,
    actorId: context.actorId,
    justActed: context.justActed ?? null,
    availableApproachIds: context.availableApproachIds,
    approaches: context.approaches,
    worldTone: context.worldTone,
    scene: context.scene,
    party: context.party,
    inventory: context.inventory,
    revealedFacts: context.revealedFacts,
    journal: context.journal,
    recentDialogue: context.recentDialogue,
    objective: context.objective,
    spineApproachId: context.spineApproachId,
    exitOnClear: context.exitOnClear,
    exitOnSetback: context.exitOnSetback,
  });
}

export function narrateUserPayload(context: NarrateContext): string {
  return JSON.stringify({
    task: 'narrate',
    locale: context.locale,
    untrustedPlayerText: context.text ?? '',
    actorId: context.actorId,
    justActed: context.justActed ?? null,
    speakToNext: context.speakToNext ?? null,
    outcome: context.outcome,
    resolutionNote: context.resolutionNote ?? null,
    toll: context.toll ?? null,
    objective: context.objective,
    exitOnClear: context.exitOnClear,
    exitOnSetback: context.exitOnSetback,
    check: context.check,
    resourceChanges: context.resourceChanges,
    nextActorId: context.nextActorId,
    newlyRevealedFacts: context.newlyRevealedFacts,
    sceneTransition: context.sceneTransition,
    endingKind: context.endingKind,
    availableApproachIds: context.availableApproachIds,
    challengesOpen: (context.availableApproachIds?.length ?? 0) > 0,
    worldTone: context.worldTone,
    scene: context.scene,
    party: context.party,
    inventory: context.inventory,
    revealedFacts: context.revealedFacts,
    journal: context.journal,
    recentDialogue: context.recentDialogue,
  });
}

function trimDialogue(
  messages: MessageRow[],
  party: SessionState['party'],
): Array<{ kind: string; speaker?: string; text: string }> {
  const lines = messages.slice(-8).flatMap((row) => {
    const line = dialogueFromMessage(row, party);
    return line ? [line] : [];
  });
  const limited: Array<{ kind: string; text: string }> = [];
  let total = 0;
  for (const line of [...lines].reverse()) {
    const next = total + line.text.length;
    if (next > 6_000) {
      break;
    }
    limited.unshift(line);
    total = next;
  }
  return limited;
}

function trimContext<T>(value: T): T {
  const encoded = JSON.stringify(value);
  if (encoded.length <= PROMPT_BUDGET) {
    return value;
  }
  const copy = structuredClone(value) as T & {
    recentDialogue?: unknown[];
    journal?: unknown[];
  };
  copy.recentDialogue = [];
  copy.journal = [];
  if (JSON.stringify(copy).length > PROMPT_BUDGET) {
    throw new Error('Required provider context exceeds the prompt budget');
  }
  return copy;
}

export function contextContainsSecret(payload: string, secret: string): boolean {
  return payload.includes(secret);
}
