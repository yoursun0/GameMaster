import { describe, expect, test } from 'vitest';
import { endingKind, resolveAction, sceneThresholds } from '@/server/game/rules';
import { actorId, check, ok, pass, patchState, start } from './helpers';
import { testCampaign } from '../fixtures/test-campaign';

function playUntilDone(
  profiles: Array<'guardian' | 'specialist' | 'mediator' | 'scout'>,
  die: number,
): ReturnType<typeof start> {
  let state = start(profiles);
  let guard = 0;
  while (state.status === 'active') {
    guard += 1;
    if (guard > 200) {
      throw new Error('Adventure did not end');
    }
    if (state.scene.closingReason) {
      state = pass(state).state;
      continue;
    }
    const attribute = ['might', 'agility', 'insight', 'presence'][
      state.turn.activeSeat % 4
    ] as 'might' | 'agility' | 'insight' | 'presence';
    const approachId = `s${state.scene.index}-${attribute}`;
    const result = resolveAction(
      state,
      testCampaign,
      { kind: 'check', actorId: actorId(state), approachId },
      () => die,
    );
    if (!result.ok) {
      state = pass(state).state;
      continue;
    }
    state = result.state;
  }
  return state;
}

describe('turns, scenes and endings', () => {
  test('one-player and four-player thresholds scale with party size', () => {
    expect(sceneThresholds(1)).toEqual({
      progressTarget: 2,
      threatLimit: 2,
      maxResolvedRounds: 2,
    });
    expect(sceneThresholds(4)).toEqual({
      progressTarget: 4,
      threatLimit: 4,
      maxResolvedRounds: 2,
    });
    const solo = check(start(['guardian']), 's0-might', 20);
    expect(solo.sceneResult).toBe('cleared');
    expect(solo.state.scene.index).toBe(1);
  });

  test('questions keep the seat and resources', () => {
    const state = start(['guardian']);
    const result = ok(
      resolveAction(state, testCampaign, {
        kind: 'question',
        actorId: actorId(state),
      }),
    );
    expect(result.consumedTurn).toBe(false);
    expect(result.state.turn.activeSeat).toBe(0);
    expect(result.state.party[0].hp).toBe(14);
    expect(result.state.committedActionCount).toBe(0);
  });

  test('pass spends no resources and all-pass rounds do not set back', () => {
    let state = start(['guardian', 'specialist']);
    const hp = state.party[0].hp;
    state = pass(state).state;
    expect(state.party[0].hp).toBe(hp);
    expect(state.turn.activeSeat).toBe(1);
    state = pass(state).state;
    expect(state.scene.index).toBe(0);
    expect(state.scene.resolvedRounds).toBe(0);
    expect(state.scene.closingReason).toBeNull();
    expect(state.turn.activeSeat).toBe(0);
    expect(state.turn.visitedSeats).toEqual([]);
  });

  test('two resolved rounds without clearing cause a setback', () => {
    let state = start(['guardian', 'specialist']);
    state = ok(
      resolveAction(state, testCampaign, {
        kind: 'automatic',
        actorId: actorId(state),
      }),
    ).state;
    state = pass(state).state;
    expect(state.scene.resolvedRounds).toBe(1);
    state = ok(
      resolveAction(state, testCampaign, {
        kind: 'automatic',
        actorId: actorId(state),
      }),
    ).state;
    state = pass(state).state;
    expect(state.scene.index).toBe(1);
    expect(state.sceneResults[0]?.result).toBe('setback');
  });

  test('reaching a threshold lets remaining seats act before the transition', () => {
    let state = start(['guardian', 'specialist', 'mediator', 'scout']);
    state = check(state, 's0-might', 20).state;
    expect(state.scene.progress).toBe(2);
    expect(state.scene.closingReason).toBeNull();
    state = check(state, 's0-agility', 20).state;
    expect(state.scene.closingReason).toBe('cleared');
    expect(state.scene.index).toBe(0);
    expect(state.turn.activeSeat).toBe(2);
    state = pass(state).state;
    expect(state.scene.index).toBe(0);
    state = pass(state).state;
    expect(state.scene.index).toBe(1);
  });

  test('the same action hitting progress and threat prefers setback', () => {
    const state = patchState(start(['guardian']), (draft) => {
      draft.scene.progress = 1;
      draft.scene.threat = 1;
    });
    const result = check(state, 's0-might', 1);
    expect(result.check?.outcome).toBe('failure');
    expect(result.sceneResult).toBe('setback');
  });

  test('ending formula uses cleared count and the final result', () => {
    expect(endingKind(5, 'cleared')).toBe('success');
    expect(endingKind(4, 'cleared')).toBe('compromise');
    expect(endingKind(4, 'setback')).toBe('compromise');
    expect(endingKind(3, 'setback')).toBe('failure');
  });

  test('scene 6 keeps the last successful route and defaults on setback', () => {
    const disclose = patchState(
      start(['guardian', 'specialist', 'mediator', 'scout']),
      (draft) => {
        draft.scene.index = 6;
        draft.scene.challengeId = 'test-challenge-6';
        draft.cleanSceneCount = 6;
      },
    );
    const first = check(disclose, 's6-might', 20);
    expect(first.state.routeChoiceId).toBe('test-disclose');
    const second = check(first.state, 's6-insight', 20);
    expect(second.state.routeChoiceId).toBe('test-negotiate');
    expect(second.state.scene.closingReason).toBe('cleared');

    const setback = check(
      patchState(start(['guardian']), (draft) => {
        draft.scene.index = 6;
        draft.scene.challengeId = 'test-challenge-6';
        draft.scene.threat = 1;
      }),
      's6-might',
      1,
    );
    expect(setback.sceneResult).toBe('setback');
    expect(setback.state.routeChoiceId).toBe('test-negotiate');
  });

  test('failed approaches stay locked until a listed prerequisite changes', () => {
    let state = start(['guardian', 'specialist', 'mediator']);
    const failed = check(state, 's0-might', 1);
    expect(failed.check?.outcome).toBe('failure');
    state = failed.state;
    expect(
      resolveAction(
        state,
        testCampaign,
        { kind: 'check', actorId: actorId(state), approachId: 's0-might' },
        () => 20,
      ),
    ).toEqual({ ok: false, code: 'REPEAT_APPROACH' });
    state = check(state, 's0-presence', 20).state;
    state = pass(state).state;
    const unlocked = check(state, 's0-might', 20);
    expect(unlocked.ok).toBe(true);
    expect(unlocked.check?.outcome).toBe('success');
  });

  test('closing a scene rejects further challenge rolls', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.scene.closingReason = 'cleared';
    });
    expect(
      resolveAction(
        state,
        testCampaign,
        { kind: 'check', actorId: actorId(state), approachId: 's0-might' },
        () => 20,
      ),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
  });

  test('scene transition resets counters, failed approaches and round state', () => {
    const result = check(start(['guardian']), 's0-might', 20);
    expect(result.state.scene.index).toBe(1);
    expect(result.state.scene.progress).toBe(0);
    expect(result.state.scene.threat).toBe(0);
    expect(result.state.scene.failedApproaches).toEqual([]);
    expect(result.state.scene.resolvedRounds).toBe(0);
    expect(result.state.turn).toMatchObject({
      activeSeat: 0,
      round: 1,
      visitedSeats: [],
      meaningfulActionsThisRound: 0,
    });
  });

  test('final-scene group overwhelm resolves an ending', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.scene.index = 7;
      draft.scene.challengeId = 'test-challenge-7';
      draft.party[0].hp = 1;
      draft.party[1].hp = 0;
      draft.cleanSceneCount = 2;
    });
    const result = check(state, 's7-might', 1);
    expect(result.sceneResult).toBe('setback');
    expect(result.state.status).toBe('completed');
    expect(result.state.ending?.kind).toBe('failure');
  });

  test('an already-satisfied unlock requirement does not reopen a failed approach', () => {
    const state = check(
      patchState(start(['guardian', 'specialist', 'mediator']), (draft) => {
        draft.revealedFactIds.push('unlock-0');
      }),
      's0-might',
      1,
    ).state;
    expect(
      resolveAction(
        state,
        testCampaign,
        { kind: 'check', actorId: actorId(state), approachId: 's0-might' },
        () => 20,
      ),
    ).toEqual({ ok: false, code: 'REPEAT_APPROACH' });
  });

  test('rewriting the same failed approach is not a new key', () => {
    const state = check(start(['guardian', 'specialist', 'mediator']), 's0-might', 1).state;
    expect(
      resolveAction(
        state,
        testCampaign,
        { kind: 'check', actorId: actorId(state), approachId: 's0-might' },
        () => 20,
      ).ok,
    ).toBe(false);
  });

  test('a solo party can complete eight scenes on successes', () => {
    const state = playUntilDone(['guardian'], 20);
    expect(state.status).toBe('completed');
    expect(state.ending?.kind).toBe('success');
    expect(state.sceneResults).toHaveLength(8);
    expect(state.ending?.epilogues).toHaveLength(1);
  });

  test('four-player all-failure play reaches a failure ending', () => {
    const state = playUntilDone(
      ['guardian', 'specialist', 'mediator', 'scout'],
      1,
    );
    expect(state.status).toBe('completed');
    expect(state.ending?.kind).toBe('failure');
    expect(state.ending?.epilogues).toHaveLength(4);
  });
});
