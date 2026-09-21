import { z } from 'zod';

export const LOCALES = ['en', 'zh-Hant'] as const;
export const WORLD_IDS = [
  'ashen-thrones',
  'aetherfall',
  'glass-hearts',
  'cyberpunk-dawn',
] as const;
export const ATTRIBUTES = ['might', 'agility', 'insight', 'presence'] as const;
export const PROFILES = ['guardian', 'specialist', 'mediator', 'scout'] as const;
export const DIFFICULTIES = [8, 12, 16] as const;
export const OUTCOMES = ['success', 'partial', 'failure', 'automatic'] as const;
export const CONDITION_IDS = ['shaken', 'exposed', 'focused'] as const;
export const ENDING_KINDS = ['success', 'compromise', 'failure'] as const;
export const ACTION_KINDS = ['act', 'ask', 'pass', 'help', 'use_item', 'rest'] as const;

export const localeSchema = z.enum(LOCALES);
export const worldIdSchema = z.enum(WORLD_IDS);
export const attributeSchema = z.enum(ATTRIBUTES);
export const profileSchema = z.enum(PROFILES);
export const difficultySchema = z.union([
  z.literal(8),
  z.literal(12),
  z.literal(16),
]);
export const outcomeSchema = z.enum(OUTCOMES);
export const conditionIdSchema = z.enum(CONDITION_IDS);
export const endingKindSchema = z.enum(ENDING_KINDS);

export type Locale = z.infer<typeof localeSchema>;
export type WorldId = z.infer<typeof worldIdSchema>;
export type Attribute = z.infer<typeof attributeSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type ConditionId = z.infer<typeof conditionIdSchema>;
export type EndingKind = z.infer<typeof endingKindSchema>;
export type Localized = Record<Locale, string>;
export type Attributes = Record<Attribute, number>;

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

const uuidSchema = z.string().uuid();
const revisionSchema = z.number().int().nonnegative();

function textCodePoints(min: number, max: number) {
  return z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => {
        const length = codePointLength(value);
        return length >= min && length <= max;
      },
      { message: `Must be ${min}–${max} Unicode code points after trimming` },
    );
}

export const displayNameSchema = textCodePoints(1, 24);

export const submitActSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('act'),
    text: textCodePoints(1, 600),
    useAbility: z.boolean().optional(),
  })
  .strict();

export const submitAskSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('ask'),
    text: textCodePoints(1, 600),
  })
  .strict();

export const submitPassSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('pass'),
  })
  .strict();

export const submitHelpSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('help'),
    targetPlayerId: uuidSchema,
  })
  .strict();

export const submitUseItemSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('use_item'),
    itemId: z.string().min(1).max(80),
    targetPlayerId: uuidSchema,
  })
  .strict();

export const submitRestSchema = z
  .object({
    operationId: uuidSchema,
    expectedRevision: revisionSchema,
    actorId: uuidSchema,
    kind: z.literal('rest'),
  })
  .strict();

export const submitActionSchema = z.discriminatedUnion('kind', [
  submitActSchema,
  submitAskSchema,
  submitPassSchema,
  submitHelpSchema,
  submitUseItemSchema,
  submitRestSchema,
]);

export type SubmitAction = z.infer<typeof submitActionSchema>;
