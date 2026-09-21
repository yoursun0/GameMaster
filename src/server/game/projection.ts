import 'server-only';

import type { WorldPack } from '@/server/content/types';
import { ABILITY_COST, PROFILE_STATS, characterOf } from '@/server/game/profiles';
import { currentScene, sceneThresholds } from '@/server/game/scenes';
import { sessionStateSchema, type SessionState } from '@/server/game/schemas';
import type { OperationRow, MessageRow, SessionRow } from '@/server/db/repository';
import type { Attribute, ConditionId, Locale, Profile } from '@/shared/schemas';

export type PublicMessage = {
  id: string;
  seq: number;
  kind: MessageRow['kind'];
  createdAt: string;
  payload: unknown;
};

export type PendingOperationDTO = {
  id: string;
  phase: OperationRow['phase'] | 'interrupted';
  canRetry: boolean;
  canCancel: boolean;
  submittedText: string | null;
  actorId: string | null;
  errorCode: string | null;
  preview: ActionPreviewDTO | null;
};

export type ActionPreviewDTO = {
  actorId: string;
  actionText: string;
  attribute: Attribute;
  target: 8 | 12 | 16;
  attributeValue: number;
  conditionModifier: number;
  abilityModifier: number;
  mpCost: number;
  stakes: { success: string; partial: string; failure: string };
};

export type SessionDTO = {
  sessionId: string;
  revision: number;
  world: { id: string; title: string };
  locale: Locale;
  status: SessionState['status'];
  savedAt: string;
  party: Array<{
    playerId: string;
    seat: number;
    displayName: string;
    characterId: string;
    characterName: string;
    role: string;
    profile: Profile;
    biography: string;
    motivation: string;
    startingItem: { id: string; name: string; description: string };
    attributes: Record<Attribute, number>;
    hp: number;
    mp: number;
    maxHp: number;
    maxMp: number;
    conditions: Array<{ id: ConditionId }>;
    ability: { id: string; name: string; description: string; cost: number };
    active: boolean;
    overwhelmed: boolean;
  }>;
  turn: {
    activePlayerId: string;
    round: number;
    seatOrder: string[];
    visitedPlayerIds: string[];
  };
  scene: {
    id: string;
    title: string;
    act: 1 | 2 | 3;
    location: string;
    description: string;
    index: number;
    progress: number;
    threat: number;
    progressTarget: number;
    threatLimit: number;
    closingReason: SessionState['scene']['closingReason'];
  };
  objective: { text: string };
  inventory: Array<{
    itemId: string;
    name: string;
    description: string;
    quantity: number;
    usable: boolean;
    ownerId: string | null;
  }>;
  revealedFacts: Array<{ id: string; text: string }>;
  recentMessages: PublicMessage[];
  transcriptCursor: number | null;
  suggestions: SessionState['suggestions'];
  pendingOperation: PendingOperationDTO | null;
  ending: SessionState['ending'];
};

export function projectSession(args: {
  row: SessionRow;
  pack: WorldPack;
  messages: MessageRow[];
  pending: PendingOperationDTO | null;
}): SessionDTO {
  const state = sessionStateSchema.parse(JSON.parse(args.row.state_json));
  const locale = state.locale;
  const scene = currentScene(args.pack, state);
  const thresholds = sceneThresholds(state.party.length);
  const active = state.party[state.turn.activeSeat];

  return {
    sessionId: args.row.id,
    revision: args.row.revision,
    world: { id: args.pack.id, title: args.pack.title[locale] },
    locale,
    status: state.status,
    savedAt: args.row.updated_at,
    party: state.party.map((member) => {
      const character = characterOf(args.pack, member.characterId);
      const stats = PROFILE_STATS[character.profile];
      const starting = args.pack.items.find(
        (item) => item.id === character.startingItemId,
      );
      return {
        playerId: member.playerId,
        seat: member.seat,
        displayName: member.displayName,
        characterId: member.characterId,
        characterName: character.name[locale],
        role: character.role[locale],
        profile: character.profile,
        biography: character.biography[locale],
        motivation: character.motivation[locale],
        startingItem: {
          id: character.startingItemId,
          name: starting?.name[locale] ?? character.startingItemId,
          description: starting?.description[locale] ?? '',
        },
        attributes: {
          might: stats.might,
          agility: stats.agility,
          insight: stats.insight,
          presence: stats.presence,
        },
        hp: member.hp,
        mp: member.mp,
        maxHp: stats.hp,
        maxMp: stats.mp,
        conditions: member.conditions.map((condition) => ({ id: condition.id })),
        ability: {
          id: character.ability.id,
          name: character.ability.name[locale],
          description: character.ability.description[locale],
          cost: ABILITY_COST,
        },
        active: member.seat === state.turn.activeSeat,
        overwhelmed: member.hp === 0,
      };
    }),
    turn: {
      activePlayerId: active?.playerId ?? '',
      round: state.turn.round,
      seatOrder: [...state.party]
        .sort((a, b) => a.seat - b.seat)
        .map((member) => member.playerId),
      visitedPlayerIds: state.turn.visitedSeats.map(
        (seat) => state.party.find((member) => member.seat === seat)?.playerId ?? '',
      ),
    },
    scene: {
      id: scene.id,
      title: scene.title[locale],
      act: scene.act,
      location: scene.location[locale],
      description: scene.opening[locale],
      index: scene.index,
      progress: state.scene.progress,
      threat: state.scene.threat,
      progressTarget: thresholds.progressTarget,
      threatLimit: thresholds.threatLimit,
      closingReason: state.scene.closingReason,
    },
    objective: { text: scene.objective[locale] },
    inventory: state.inventory.map((entry) => {
      const item = args.pack.items.find((definition) => definition.id === entry.itemId);
      return {
        itemId: entry.itemId,
        name: item?.name[locale] ?? entry.itemId,
        description: item?.description[locale] ?? '',
        quantity: entry.quantity,
        usable: item?.kind === 'restorative' || item?.kind === 'focus-draught',
        ownerId: entry.ownerId,
      };
    }),
    revealedFacts: state.revealedFactIds.flatMap((id) => {
      const fact = args.pack.facts.find((entry) => entry.id === id);
      if (!fact) return [];
      return [{ id: fact.id, text: fact.text[locale] }];
    }),
    recentMessages: args.messages.map(projectMessage),
    transcriptCursor: args.messages.at(-1)?.seq ?? null,
    suggestions: state.suggestions,
    pendingOperation: args.pending,
    ending: state.ending,
  };
}

export function projectMessage(row: MessageRow): PublicMessage {
  return {
    id: row.id,
    seq: row.seq,
    kind: row.kind,
    createdAt: row.created_at,
    payload: JSON.parse(row.payload_json) as unknown,
  };
}

export function assertPublicDto(dto: SessionDTO): void {
  const serialized = JSON.stringify(dto);
  if (serialized.includes('DEEPSEEK') || serialized.includes('credential')) {
    throw new Error('Public DTO leaked a secret field');
  }
}
