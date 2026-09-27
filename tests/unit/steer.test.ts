import { describe, expect, test } from 'vitest';
import { steerInterpretation } from '@/server/ai/steer';

const approaches = ['s0-might', 's0-agility', 's0-insight', 's0-presence'];

describe('story steering', () => {
  test('keeps a legal check and its toll', () => {
    expect(
      steerInterpretation(
        {
          kind: 'check',
          approachId: 's0-insight',
          intentSummary: 'Read the seal',
          toll: 'focus',
        },
        approaches,
      ),
    ).toEqual({
      kind: 'check',
      approachId: 's0-insight',
      intentSummary: 'Read the seal',
      toll: 'focus',
    });
  });

  test('drags an unknown approach and a derail onto the fight', () => {
    const dragged = steerInterpretation(
      { kind: 'check', approachId: 'leave-the-war', intentSummary: 'Walk to the capital' },
      approaches,
    );
    expect(dragged.kind).toBe('check');
    if (dragged.kind === 'check') {
      expect(dragged.toll).toBe('reckless');
      expect(dragged.approachId).toBe('s0-might');
    }
    expect(
      steerInterpretation(
        { kind: 'impossible', reason: 'There is no dungeon here.' },
        approaches,
      ),
    ).toMatchObject({ kind: 'check', approachId: 's0-might', toll: 'reckless' });
  });

  test('leaves questions and harmless acts alone', () => {
    expect(
      steerInterpretation({ kind: 'question', question: 'Who is bleeding?' }, approaches).kind,
    ).toBe('question');
    expect(
      steerInterpretation({ kind: 'automatic', intentSummary: 'Sheathe the sword' }, approaches)
        .kind,
    ).toBe('automatic');
  });
});
