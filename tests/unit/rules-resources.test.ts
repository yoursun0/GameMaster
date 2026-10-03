import { describe, expect, test } from 'vitest';
import { resolveAction } from '@/server/game/rules';
import { actorId, check, ok, pass, patchState, start } from './helpers';
import { testCampaign } from '../fixtures/test-campaign';

describe('resources, recovery and items', () => {
  test('winning a fight still costs 1 HP', () => {
    const state = start(['guardian']);
    const won = check(state, 's0-might', 20);
    expect(won.state.party[0].hp).toBe(13);
    expect(won.state.scene.index).toBe(1);
  });

  test('clamps HP at zero and trust at -2', () => {
    const trust = check(
      patchState(start(['mediator', 'guardian', 'scout', 'specialist']), (draft) => {
        draft.npcTrust['test-npc-a'] = -2;
      }),
      's0-presence',
      1,
    );
    expect(trust.state.npcTrust['test-npc-a']).toBe(-2);
    const result = check(
      patchState(start(['guardian', 'specialist', 'mediator', 'scout']), (draft) => {
        draft.party[0].hp = 1;
      }),
      's0-might',
      1,
    );
    expect(result.state.party[0].hp).toBe(0);
    expect(result.state.status).toBe('active');
    expect(result.state.ending).toBeNull();
    expect(result.state.scene.index).toBe(0);
    expect(result.state.party[1].hp).toBeGreaterThan(0);
  });

  test('grants a unique story item only once', () => {
    let state = start(['mediator', 'guardian', 'scout']);
    state = check(state, 's0-presence', 20).state;
    expect(state.inventory.filter((item) => item.itemId === 'test-seal')).toHaveLength(1);
    state = pass(state).state;
    state = pass(state).state;
    state = check(state, 's0-presence', 20).state;
    expect(state.inventory.filter((item) => item.itemId === 'test-seal')).toHaveLength(1);
  });

  test('a player already at 0 HP cannot take a risky check and can drink a draught', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[0].hp = 0;
    });
    expect(
      resolveAction(
        state,
        testCampaign,
        { kind: 'check', actorId: actorId(state), approachId: 's0-might' },
        () => 20,
      ),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
    const restored = ok(
      resolveAction(state, testCampaign, {
        kind: 'use_item',
        actorId: actorId(state),
        itemId: 'test-restorative',
        targetPlayerId: actorId(state),
      }),
    );
    expect(restored.state.status).toBe('active');
    expect(restored.state.party[0].hp).toBe(4);
  });

  test('the next player can help someone at 0 HP', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[1].hp = 0;
    });
    const helped = ok(
      resolveAction(state, testCampaign, {
        kind: 'help',
        actorId: actorId(state),
        targetPlayerId: state.party[1].playerId,
      }),
    );
    expect(helped.state.status).toBe('active');
    expect(helped.state.ending).toBeNull();
    expect(helped.state.party[1].hp).toBe(3);
  });

  test('items restore clamped amounts and reject wasted uses', () => {
    const full = start(['guardian']);
    expect(
      resolveAction(full, testCampaign, {
        kind: 'use_item',
        actorId: actorId(full),
        itemId: 'test-restorative',
        targetPlayerId: actorId(full),
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
    const wounded = patchState(full, (draft) => {
      draft.party[0].hp = 12;
      draft.party[0].mp = 1;
    });
    const hp = ok(
      resolveAction(wounded, testCampaign, {
        kind: 'use_item',
        actorId: actorId(wounded),
        itemId: 'test-restorative',
        targetPlayerId: actorId(wounded),
      }),
    );
    expect(hp.state.party[0].hp).toBe(14);
    const mp = ok(
      resolveAction(
        patchState(start(['guardian']), (draft) => {
          draft.party[0].mp = 1;
        }),
        testCampaign,
        {
          kind: 'use_item',
          actorId: 'player-0',
          itemId: 'test-focus-draught',
          targetPlayerId: 'player-0',
        },
      ),
    );
    expect(mp.state.party[0].mp).toBe(4);
  });

  test('rest is once per rest scene and heals the party', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.scene.index = 3;
      draft.scene.challengeId = 'test-challenge-3';
      draft.party[0].hp = 8;
      draft.party[1].mp = 2;
    });
    expect(
      resolveAction(start(['guardian']), testCampaign, {
        kind: 'rest',
        actorId: 'player-0',
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
    const rested = ok(
      resolveAction(state, testCampaign, { kind: 'rest', actorId: actorId(state) }),
    );
    expect(rested.state.party[0].hp).toBe(11);
    expect(rested.state.party[1].mp).toBe(4);
    expect(rested.state.flags).toContain('rest-used');
    expect(
      resolveAction(rested.state, testCampaign, {
        kind: 'rest',
        actorId: actorId(rested.state),
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
  });

  test('the whole party at 0 HP leaves as a setback at 1 HP', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[0].hp = 1;
      draft.party[1].hp = 0;
    });
    const result = check(state, 's0-might', 1);
    expect(result.sceneResult).toBe('setback');
    expect(result.state.status).toBe('active');
    expect(result.state.ending).toBeNull();
    expect(result.state.scene.index).toBe(1);
    expect(result.state.party[0].hp).toBe(1);
    expect(result.state.party[1].hp).toBe(1);
    expect(result.state.party[1].mp).toBe(8);
  });

  test('scene transition clears conditions and leaves living HP unchanged', () => {
    const state = patchState(start(['guardian']), (draft) => {
      draft.party[0].hp = 8;
      draft.party[0].conditions.push({
        id: 'exposed',
        appliedAtAction: 0,
        expires: 'scene_end',
      });
      draft.scene.closingReason = 'cleared';
    });
    const result = pass(state);
    expect(result.state.scene.index).toBe(1);
    expect(result.state.party[0].hp).toBe(8);
    expect(result.state.party[0].conditions).toEqual([]);
    expect(result.state.status).toBe('active');
  });

  test('a solo wipe on a cleared scene still leaves at 1 HP', () => {
    const state = patchState(start(['guardian']), (draft) => {
      draft.party[0].hp = 0;
      draft.party[0].conditions.push({
        id: 'exposed',
        appliedAtAction: 0,
        expires: 'scene_end',
      });
      draft.scene.closingReason = 'cleared';
    });
    const result = pass(state);
    expect(result.sceneResult).toBe('cleared');
    expect(result.state.status).toBe('active');
    expect(result.state.scene.index).toBe(1);
    expect(result.state.party[0].hp).toBe(1);
    expect(result.state.party[0].conditions).toEqual([]);
  });

  test('cover moves one wound onto the actor and grants +2 once', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[1].hp = 6;
      draft.party[1].lastWoundHp = 2;
    });
    const covered = ok(
      resolveAction(state, testCampaign, {
        kind: 'cover',
        actorId: actorId(state),
        targetPlayerId: state.party[1].playerId,
      }),
    );
    expect(covered.state.party[1].hp).toBe(7);
    expect(covered.state.party[0].hp).toBe(13);
    expect(covered.state.party[1].conditions[0]?.id).toBe('covered');
    expect(
      resolveAction(start(['guardian']), testCampaign, {
        kind: 'cover',
        actorId: 'player-0',
        targetPlayerId: 'player-0',
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT' });
    const rolled = check(covered.state, 's0-insight', 10);
    expect(rolled.check?.conditionModifier).toBe(2);
    expect(rolled.state.party[1].conditions.some((condition) => condition.id === 'covered')).toBe(false);
  });
});
