import { describe, expect, test } from 'vitest';
import {
  computeCheck,
  conditionModifierFor,
  resolveAction,
  sumConditionModifiers,
  MAX_DIE,
  MIN_DIE,
} from '@/server/game/rules';
import { actorId, check, ok, patchState, start } from './helpers';
import { testCampaign } from '../fixtures/test-campaign';

describe('check calculation', () => {
  test('outcomes at target, target-1, target-3 and target-4', () => {
    expect(computeCheck({ die: 8, attributeValue: 4, conditionModifier: 0, abilityUsed: false, target: 12 }).outcome).toBe('success');
    expect(computeCheck({ die: 7, attributeValue: 4, conditionModifier: 0, abilityUsed: false, target: 12 }).outcome).toBe('partial');
    expect(computeCheck({ die: 5, attributeValue: 4, conditionModifier: 0, abilityUsed: false, target: 12 }).outcome).toBe('partial');
    expect(computeCheck({ die: 4, attributeValue: 4, conditionModifier: 0, abilityUsed: false, target: 12 }).outcome).toBe('failure');
  });

  test('uses dice in the d20 range', () => {
    expect(MIN_DIE).toBe(1);
    expect(MAX_DIE).toBe(20);
    const result = check(start(['guardian']), 's0-might', 1);
    expect(result.check?.die).toBe(1);
    const high = check(start(['guardian']), 's0-might', 20);
    expect(high.check?.die).toBe(20);
    expect(high.check?.total).toBe(24);
  });

  test('matching ability spends MP and adds +3', () => {
    const result = check(start(['guardian']), 's0-might', 5, true);
    expect(result.check).toMatchObject({
      abilityModifier: 3,
      total: 12,
      outcome: 'success',
    });
    expect(result.state.party[0].mp).toBe(2);
  });

  test('non-matching ability is rejected without spending or taking a turn', () => {
    const state = start(['guardian']);
    const result = resolveAction(
      state,
      testCampaign,
      { kind: 'check', actorId: actorId(state), approachId: 's0-agility', useAbility: true },
      () => 20,
    );
    expect(result).toEqual({ ok: false, code: 'ABILITY_NOT_APPLICABLE' });
    expect(state.party[0].mp).toBe(4);
    expect(state.turn.activeSeat).toBe(0);
    expect(state.committedActionCount).toBe(0);
  });

  test('insufficient MP is rejected without rolling', () => {
    const state = patchState(start(['guardian']), (draft) => {
      draft.party[0].mp = 1;
    });
    const result = resolveAction(
      state,
      testCampaign,
      { kind: 'check', actorId: actorId(state), approachId: 's0-might', useAbility: true },
      () => 20,
    );
    expect(result).toEqual({ ok: false, code: 'INSUFFICIENT_MP' });
    expect(state.party[0].mp).toBe(1);
  });

  test('condition modifiers clamp to -2..+2', () => {
    expect(sumConditionModifiers([-1, -1, -1])).toBe(-2);
    expect(sumConditionModifiers([1, 1, 1])).toBe(2);
  });

  test('focused adds +1 to the next check and is consumed', () => {
    let state = start(['guardian', 'specialist', 'mediator']);
    state = ok(resolveAction(state, testCampaign, { kind: 'pass', actorId: actorId(state) })).state;
    const granted = check(state, 's0-insight', 20);
    expect(granted.state.party[1].conditions.map((condition) => condition.id)).toEqual(['focused']);
    expect(granted.state.scene.progress).toBe(2);
    state = granted.state;
    state = ok(resolveAction(state, testCampaign, { kind: 'pass', actorId: actorId(state) })).state;
    state = ok(resolveAction(state, testCampaign, { kind: 'pass', actorId: actorId(state) })).state;
    const used = check(state, 's0-might', 10);
    expect(used.check?.conditionModifier).toBe(1);
    expect(used.check?.total).toBe(12);
    expect(used.state.party[1].conditions).toEqual([]);
  });

  test('shaken applies -1 presence until scene end', () => {
    const shaken = patchState(start(['mediator', 'guardian', 'scout']), (draft) => {
      draft.party[0].conditions.push({
        id: 'shaken',
        appliedAtAction: 0,
        expires: 'scene_end',
      });
    });
    expect(conditionModifierFor(shaken.party[0], 'presence')).toBe(-1);
    const result = check(shaken, 's0-presence', 20);
    expect(result.check?.conditionModifier).toBe(-1);
    expect(result.state.party[0].conditions[0]?.id).toBe('shaken');
  });
});
