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
  if (qa && (value.journalFact !== null || value.ending !== null)) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Q&A narration cannot include journal or ending');
  }
  if (context.endingKind) {
    if (value.suggestions.length !== 0) {
      throw new ProviderError('AI_INVALID_OUTPUT', 'Ending narration must not include suggestions');
    }
    const expected = context.partyPlayerIds ?? [];
    const epilogues = value.ending?.epilogues ?? [];
    const ids = epilogues.map((entry) => entry.playerId);
    if (
      expected.length > 0 &&
      (new Set(ids).size !== expected.length ||
        expected.some((playerId) => !ids.includes(playerId)))
    ) {
      throw new ProviderError('AI_INVALID_OUTPUT', 'Ending must include one epilogue per player');
    }
  } else if (!qa && (value.suggestions.length < 2 || value.suggestions.length > 3)) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Active narration needs 2–3 suggestions');
  }
  const allowedApproaches = new Set(context.availableApproachIds ?? []);
  for (const suggestion of value.suggestions) {
    if (suggestion.approachId && !allowedApproaches.has(suggestion.approachId)) {
      throw new ProviderError(
        'AI_INVALID_OUTPUT',
        `Unknown suggestion approach ${suggestion.approachId}`,
      );
    }
  }
  const allowedFacts = new Set(context.revealedFactIds ?? []);
  if (value.journalFact) {
    for (const id of value.journalFact.evidenceIds) {
      if (!allowedFacts.has(id)) {
        throw new ProviderError('AI_INVALID_OUTPUT', `Unknown evidence ${id}`);
      }
    }
  }
  const allowedPlayers = new Set(context.partyPlayerIds ?? []);
  if (value.ending) {
    for (const epilogue of value.ending.epilogues) {
      if (allowedPlayers.size > 0 && !allowedPlayers.has(epilogue.playerId)) {
        throw new ProviderError('AI_INVALID_OUTPUT', `Unknown player ${epilogue.playerId}`);
      }
    }
  }
  if (Array.from(value.paragraphs.join('')).length > 1600) {
    throw new ProviderError('AI_INVALID_OUTPUT', 'Narration paragraphs exceed 1600 code points');
  }
  return value;
}
