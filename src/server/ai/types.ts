import 'server-only';

import { z } from 'zod';

export const interpretationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('check'),
      approachId: z.string().min(1).max(80),
      intentSummary: z.string().min(1).max(300),
      toll: z.enum(['none', 'body', 'focus', 'reckless']).optional(),
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
    paragraphs: z.array(z.string().min(1)).min(1).max(4),
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
    harms: z
      .array(
        z
          .object({
            playerId: z.string().min(1),
            hp: z.number().int().min(0).max(6).optional(),
            mp: z.number().int().min(0).max(4).optional(),
          })
          .strict(),
      )
      .max(4)
      .optional(),
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

export type PublicApproachHint = {
  id: string;
  label: string;
  attribute: string;
};

export type PublicIdentity = {
  playerId: string;
  name: string;
  role: string;
};

export type InterpretContext = {
  locale: 'en' | 'zh-Hant';
  actorId: string;
  text: string;
  useAbility: boolean;
  availableApproachIds: string[];
  worldTone?: string;
  scene?: { id: string; title: string; description: string };
  justActed?: PublicIdentity;
  party?: Array<
    PublicIdentity & {
      hp: number;
      mp: number;
      active: boolean;
    }
  >;
  inventory?: Array<{ itemId: string; name: string; quantity: number }>;
  revealedFacts?: Array<{ id: string; text: string }>;
  journal?: string[];
  recentDialogue?: Array<{ kind: string; speaker?: string; text: string }>;
  approaches?: PublicApproachHint[];
  objective?: string;
  spineApproachId?: string;
  exitOnClear?: string;
  exitOnSetback?: string;
};

export type NarrateContext = {
  locale: 'en' | 'zh-Hant';
  actorId: string;
  text?: string;
  justActed?: PublicIdentity;
  speakToNext?: PublicIdentity | null;
  outcome: string;
  resolutionNote?: string;
  toll?: string;
  objective?: string;
  exitOnClear?: string;
  exitOnSetback?: string;
  nextActorId?: string;
  availableApproachIds?: string[];
  partyPlayerIds?: string[];
  revealedFactIds?: string[];
  newlyRevealedFacts?: Array<{ id: string; text: string }>;
  check?: {
    die: number;
    attribute: string;
    total: number;
    target: number;
    outcome: string;
  };
  resourceChanges?: Array<{ playerId: string; hp: number; mp: number }>;
  sceneTransition?: { nextId: string; opening: string } | null;
  endingKind?: string | null;
  seatJob?: string;
  worldTone?: string;
  scene?: { id: string; title: string; description: string };
  party?: InterpretContext['party'];
  inventory?: InterpretContext['inventory'];
  revealedFacts?: InterpretContext['revealedFacts'];
  journal?: string[];
  recentDialogue?: InterpretContext['recentDialogue'];
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
