import 'server-only';

import { z } from 'zod';

export const interpretationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('check'),
      approachId: z.string().min(1).max(80),
      intentSummary: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal('automatic'),
      intentSummary: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal('question'),
      question: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal('clarify'),
      question: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal('impossible'),
      reason: z.string().min(1).max(300),
    })
    .strict(),
]);

export type Interpretation = z.infer<typeof interpretationSchema>;

export const narrationSchema = z
  .object({
    paragraphs: z.array(z.string().min(1)).min(1).max(3),
    quote: z.string().max(240).nullable(),
    prompt: z.string().max(200).nullable(),
    suggestions: z
      .array(
        z
          .object({
            text: z.string().min(1).max(100),
            approachId: z.string().max(80).nullable(),
          })
          .strict(),
      )
      .max(3),
    journalFact: z
      .object({
        text: z.string().min(1).max(240),
        evidenceIds: z.array(z.string().min(1)),
      })
      .strict()
      .nullable(),
    ending: z
      .object({
        summary: z.string().min(1).max(1000),
        epilogues: z.array(
          z
            .object({
              playerId: z.string().min(1),
              text: z.string().min(1).max(500),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type Narration = z.infer<typeof narrationSchema>;

export type InterpretContext = {
  locale: 'en' | 'zh-Hant';
  actorId: string;
  text: string;
  useAbility: boolean;
  availableApproachIds: string[];
};

export type NarrateContext = {
  locale: 'en' | 'zh-Hant';
  actorId: string;
  text?: string;
  outcome: string;
};

export interface GameMaster {
  interpret(context: InterpretContext): Promise<Interpretation>;
  narrate(context: NarrateContext): Promise<Narration>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: 'AI_TIMEOUT' | 'AI_UNAVAILABLE' | 'AI_INVALID_OUTPUT',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
