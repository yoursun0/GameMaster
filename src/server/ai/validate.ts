import 'server-only';

import { ProviderError, type InterpretContext, type Interpretation, type NarrateContext, type Narration } from './types';

export function assertInterpretation(
  value: Interpretation,
  context: InterpretContext,
): Interpretation {
  if (value.kind === 'check' && !context.availableApproachIds.includes(value.approachId)) {
    throw new ProviderError('AI_INVALID_OUTPUT', `Unknown approach ${value.approachId}`);
  }
  return value;
}

export function assertNarration(
  value: Narration,
  context: NarrateContext,
): Narration {
  const qa = ['question', 'clarify', 'impossible'].includes(context.outcome);
  const challengesClosed =
    !qa && !context.endingKind && (context.availableApproachIds?.length ?? 0) === 0;
  if (qa && (value.journalFact !== null || value.ending !== null)) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Q&A narration cannot include journal or ending');
  }
  const narration: Narration = challengesClosed
    ? {
        ...value,
        suggestions: value.suggestions.slice(0, 3).map((entry) => ({
          text: entry.text,
          approachId: null,
        })),
      }
    : value;
  if (context.endingKind) {
    if (narration.suggestions.length !== 0) {
      throw new ProviderError('AI_INVALID_OUTPUT', 'Ending narration must not include suggestions');
    }
    const expected = context.partyPlayerIds ?? [];
    const epilogues = narration.ending?.epilogues ?? [];
    const ids = epilogues.map((entry) => entry.playerId);
    if (
      expected.length > 0 &&
      (new Set(ids).size !== expected.length ||
        expected.some((playerId) => !ids.includes(playerId)))
    ) {
      throw new ProviderError('AI_INVALID_OUTPUT', 'Ending must include one epilogue per player');
    }
  } else if (
    !qa &&
    !challengesClosed &&
    (narration.suggestions.length < 2 || narration.suggestions.length > 3)
  ) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Active narration needs 2–3 suggestions');
  }
  if (!qa && !context.endingKind && !challengesClosed) {
    for (const suggestion of narration.suggestions) {
      if (!suggestion.approachId) {
        throw new ProviderError('AI_INVALID_OUTPUT', 'Active suggestion must name an approach');
      }
    }
  }
  const allowedApproaches = new Set(context.availableApproachIds ?? []);
  for (const suggestion of narration.suggestions) {
    if (suggestion.approachId && !allowedApproaches.has(suggestion.approachId)) {
      throw new ProviderError(
        'AI_INVALID_OUTPUT',
        `Unknown suggestion approach ${suggestion.approachId}`,
      );
    }
  }
  const allowedFacts = new Set(context.revealedFactIds ?? []);
  if (narration.journalFact) {
    for (const id of narration.journalFact.evidenceIds) {
      if (!allowedFacts.has(id)) {
        throw new ProviderError('AI_INVALID_OUTPUT', `Unknown evidence ${id}`);
      }
    }
  }
  const allowedPlayers = new Set(context.partyPlayerIds ?? []);
  if (narration.ending) {
    for (const epilogue of narration.ending.epilogues) {
      if (allowedPlayers.size > 0 && !allowedPlayers.has(epilogue.playerId)) {
        throw new ProviderError('AI_INVALID_OUTPUT', `Unknown player ${epilogue.playerId}`);
      }
    }
  }
  if (Array.from(narration.paragraphs.join('')).length > 2800) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Narration paragraphs exceed 2800 code points');
  }
  const beat = spokenBeatProblem(narration.paragraphs, context.locale, qa || Boolean(context.endingKind));
  if (beat) {
    throw new ProviderError('AI_INVALID_OUTPUT', beat);
  }
  if (context.itemUse) {
    return { ...narration, harms: [] };
  }
  return narration;
}

export function spokenBeatProblem(
  paragraphs: string[],
  locale: 'en' | 'zh-Hant',
  skip: boolean,
): string | null {
  if (skip) return null;
  const text = paragraphs.join('');
  if (!/「[^」]{1,80}」/u.test(text)) {
    return 'Narration needs a spoken line';
  }
  if (locale === 'zh-Hant' && Array.from(text).length > 350) {
    return 'Narration is too long';
  }
  if (locale === 'en' && text.split(/\s+/).filter(Boolean).length > 180) {
    return 'Narration is too long';
  }
  return null;
}
