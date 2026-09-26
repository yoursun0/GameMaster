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
      const match =
        context.availableApproachIds.find((id) => context.text.includes(id)) ??
        context.approaches?.find((approach) =>
          context.text.toLowerCase().includes(approach.label.toLowerCase()),
        )?.id ??
        context.availableApproachIds[0];
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
  const prompt =
    context.locale === 'zh-Hant' ? '你要怎麼做？' : 'What do you do next?';
  const paragraph =
    context.locale === 'zh-Hant'
      ? `主持人記下結果：${context.outcome}。`
      : `The Game Master notes the outcome: ${context.outcome}.`;
  return {
    paragraphs: [paragraph],
    quote: null,
    prompt: context.endingKind ? null : prompt,
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
