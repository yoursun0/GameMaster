import { z } from 'zod';
import {
  conditionIdSchema,
  endingKindSchema,
  localeSchema,
} from '@/shared/schemas';

export const characterConditionSchema = z
  .object({
    id: conditionIdSchema,
    appliedAtAction: z.number().int().nonnegative(),
    expires: z.enum(['next_check', 'scene_end']),
  })
  .strict();

export const characterStateSchema = z
  .object({
    playerId: z.string().min(1),
    seat: z.number().int().min(0).max(3),
    displayName: z.string().min(1),
    characterId: z.string().min(1),
    hp: z.number().int().nonnegative(),
    mp: z.number().int().nonnegative(),
    conditions: z.array(characterConditionSchema),
  })
  .strict();

export const sessionStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    worldId: z.string().min(1),
    contentVersion: z.literal(1),
    locale: localeSchema,
    status: z.enum(['active', 'completed', 'abandoned']),
    party: z.array(characterStateSchema).min(1).max(4),
    turn: z
      .object({
        activeSeat: z.number().int().min(0).max(3),
        round: z.number().int().positive(),
        visitedSeats: z.array(z.number().int().min(0).max(3)),
        meaningfulActionsThisRound: z.number().int().nonnegative(),
      })
      .strict(),
    scene: z
      .object({
        index: z.number().int().min(0).max(7),
        challengeId: z.string().min(1),
        progress: z.number().int().nonnegative(),
        threat: z.number().int().nonnegative(),
        resolvedRounds: z.number().int().nonnegative(),
        closingReason: z.enum(['cleared', 'setback']).nullable(),
        failedApproaches: z.array(
          z
            .object({
              key: z.string().min(1),
              prerequisiteFingerprint: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    inventory: z.array(
      z
        .object({
          itemId: z.string().min(1),
          quantity: z.number().int().positive(),
          ownerId: z.string().min(1).nullable(),
        })
        .strict(),
    ),
    npcTrust: z.record(z.string(), z.number().int().min(-2).max(2)),
    flags: z.array(z.string()),
    revealedFactIds: z.array(z.string()),
    routeChoiceId: z.string().min(1).nullable(),
    cleanSceneCount: z.number().int().nonnegative(),
    committedActionCount: z.number().int().nonnegative(),
    sceneResults: z.array(
      z
        .object({
          sceneId: z.string().min(1),
          result: z.enum(['cleared', 'setback']),
          choiceIds: z.array(z.string()),
        })
        .strict(),
    ),
    publicJournal: z.array(
      z
        .object({
          messageId: z.string().min(1),
          sceneId: z.string().min(1),
          text: z.string().min(1),
        })
        .strict(),
    ),
    currentPrompt: z.string(),
    suggestions: z.array(
      z
        .object({
          text: z.string().min(1),
          approachId: z.string().min(1).nullable(),
        })
        .strict(),
    ),
    ending: z
      .object({
        kind: endingKindSchema,
        summary: z.string().min(1),
        epilogues: z.array(
          z
            .object({
              playerId: z.string().min(1),
              text: z.string().min(1),
            })
            .strict(),
        ),
      })
      .nullable(),
  })
  .strict();

export type CharacterCondition = z.infer<typeof characterConditionSchema>;
export type CharacterState = z.infer<typeof characterStateSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;

export const REST_USED_FLAG = 'rest-used';

export type RulesErrorCode =
  | 'SESSION_ENDED'
  | 'INVALID_TARGET'
  | 'ABILITY_NOT_APPLICABLE'
  | 'INSUFFICIENT_MP'
  | 'REPEAT_APPROACH'
  | 'INVALID_INPUT';

export type EngineAction =
  | {
      kind: 'check';
      actorId: string;
      approachId: string;
      useAbility?: boolean;
    }
  | { kind: 'automatic'; actorId: string }
  | { kind: 'question'; actorId: string }
  | { kind: 'clarify'; actorId: string }
  | { kind: 'impossible'; actorId: string }
  | { kind: 'pass'; actorId: string }
  | { kind: 'help'; actorId: string; targetPlayerId: string }
  | { kind: 'use_item'; actorId: string; itemId: string; targetPlayerId: string }
  | { kind: 'rest'; actorId: string };

export type CheckBreakdown = {
  actorId: string;
  attribute: 'might' | 'agility' | 'insight' | 'presence';
  die: number;
  attributeValue: number;
  conditionModifier: number;
  abilityModifier: number;
  target: 8 | 12 | 16;
  total: number;
  outcome: 'success' | 'partial' | 'failure';
};

export type EngineSuccess = {
  ok: true;
  state: SessionState;
  check: CheckBreakdown | null;
  consumedTurn: boolean;
  sceneResult: 'cleared' | 'setback' | null;
};

export type EngineFailure = {
  ok: false;
  code: RulesErrorCode;
};

export type EngineResult = EngineSuccess | EngineFailure;
