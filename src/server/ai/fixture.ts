import 'server-only';

import type {
  GameMaster,
  InterpretContext,
  Interpretation,
  NarrateContext,
  Narration,
} from './types';
import { ProviderError } from './types';

export type ScriptedMasterOptions = {
  interpret?:
    | Interpretation
    | ((context: InterpretContext) => Interpretation | Promise<Interpretation>);
  narrate?:
    | Narration
    | ((context: NarrateContext) => Narration | Promise<Narration>);
};

export function createScriptedMaster(
  options: ScriptedMasterOptions = {},
): GameMaster {
  return {
    async interpret(context) {
      if (typeof options.interpret === 'function') {
        return await options.interpret(context);
      }
      if (options.interpret) {
        return options.interpret;
      }
      const match = context.availableApproachIds.find((id) =>
        context.text.includes(id),
      );
      if (match) {
        return {
          kind: 'check',
          approachId: match,
          intentSummary: context.text.slice(0, 80),
        };
      }
      return { kind: 'automatic', intentSummary: context.text.slice(0, 80) };
    },
    async narrate(context) {
      if (typeof options.narrate === 'function') {
        return options.narrate(context);
      }
      if (options.narrate) {
        return options.narrate;
      }
      return defaultNarration(context);
    },
  };
}

export function defaultNarration(context: NarrateContext): Narration {
  return {
    paragraphs: [`The Game Master notes: ${context.outcome}.`],
    quote: null,
    prompt: 'What will you do?',
    suggestions: [],
    journalFact: null,
    ending: null,
  };
}

export function timeoutMaster(): GameMaster {
  return {
    async interpret() {
      throw new ProviderError('AI_TIMEOUT', 'interpret timeout');
    },
    async narrate() {
      throw new ProviderError('AI_TIMEOUT', 'narrate timeout');
    },
  };
}
