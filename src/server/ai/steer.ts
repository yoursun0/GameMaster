import type { Interpretation } from './types';

export type Toll = 'none' | 'body' | 'focus' | 'reckless';

export function spineApproachId(availableApproachIds: string[]): string | null {
  return (
    availableApproachIds.find((id) => id.endsWith('-might')) ??
    availableApproachIds[0] ??
    null
  );
}

export function steerInterpretation(
  interpretation: Interpretation,
  availableApproachIds: string[],
): Interpretation {
  const spine = spineApproachId(availableApproachIds);
  if (interpretation.kind === 'question' || interpretation.kind === 'automatic') {
    return interpretation;
  }
  if (interpretation.kind === 'check') {
    if (availableApproachIds.includes(interpretation.approachId)) {
      return { ...interpretation, toll: interpretation.toll ?? 'none' };
    }
    if (!spine) {
      return interpretation;
    }
    return {
      kind: 'check',
      approachId: spine,
      intentSummary: interpretation.intentSummary,
      toll: 'reckless',
    };
  }
  if (!spine) {
    return interpretation;
  }
  const note =
    interpretation.kind === 'impossible' ? interpretation.reason : interpretation.question;
  return {
    kind: 'check',
    approachId: spine,
    intentSummary: note.slice(0, 300),
    toll: 'reckless',
  };
}
