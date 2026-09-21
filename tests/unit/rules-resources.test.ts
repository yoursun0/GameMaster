import { describe, expect, test } from 'vitest';
import { resolveAction } from '@/server/game/rules';
import { actorId, check, ok, pass, patchState, start } from './helpers';
import { testCampaign } from '../fixtures/test-campaign';

describe('resources, recovery and items', () => {
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

  test('zero-HP actors cannot take risky actions but can use a restorative', () => {
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
    expect(restored.state.party[0].hp).toBe(4);
  });

  test('help restores an overwhelmed ally to 3 HP and rejects invalid targets', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[1].hp = 0;
    });
    expect(
      resolveAction(state, testCampaign, {
        kind: 'help',
        actorId: actorId(state),
        targetPlayerId: actorId(state),
      }),
    ).toEqual({ ok: false, code: 'INVALID_TARGET' });
    const helped = ok(
      resolveAction(state, testCampaign, {
        kind: 'help',
        actorId: actorId(state),
        targetPlayerId: state.party[1].playerId,
      }),
    );
    expect(helped.state.party[1].hp).toBe(3);
    expect(
      resolveAction(helped.state, testCampaign, {
        kind: 'help',
        actorId: actorId(helped.state),
        targetPlayerId: state.party[0].playerId,
      }),
    ).toEqual({ ok: false, code: 'INVALID_TARGET' });
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

  test('group overwhelm setbacks immediately and recovers everyone to 3 HP', () => {
    const state = patchState(start(['guardian', 'specialist']), (draft) => {
      draft.party[0].hp = 1;
      draft.party[1].hp = 0;
    });
    const result = check(state, 's0-might', 1);
    expect(result.sceneResult).toBe('setback');
    expect(result.state.scene.index).toBe(1);
    expect(result.state.party.every((member) => member.hp === 3)).toBe(true);
    expect(result.state.party[1].mp).toBe(8);
  });

  test('scene transition clears conditions and recovers only zero HP', () => {
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
    expect(result.state.scene.index).toBe(1);
    expect(result.state.party[0].hp).toBe(3);
    expect(result.state.party[0].conditions).toEqual([]);
  });
});
