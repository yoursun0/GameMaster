import { expect } from 'vitest';
import { createInitialState, resolveAction } from '@/server/game/rules';
import { sessionStateSchema, type EngineResult, type SessionState } from '@/server/game/schemas';
import { testCampaign, TEST_CHARACTERS } from '../fixtures/test-campaign';
import type { Profile } from '@/shared/schemas';

export function start(profiles: Profile[], locale: 'en' | 'zh-Hant' = 'en'): SessionState {
  return createInitialState(
    {
      locale,
      players: profiles.map((profile, index) => ({
        playerId: `player-${index}`,
        displayName: `Player ${index + 1}`,
        characterId: TEST_CHARACTERS[profile],
      })),
    },
    testCampaign,
  );
}

export function ok(result: EngineResult): Extract<EngineResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.code}`);
  }
  return result;
}

export function actorId(state: SessionState): string {
  return state.party[state.turn.activeSeat].playerId;
}

export function check(
  state: SessionState,
  approachId: string,
  die: number,
  useAbility = false,
): Extract<EngineResult, { ok: true }> {
  return ok(
    resolveAction(
      state,
      testCampaign,
      { kind: 'check', actorId: actorId(state), approachId, useAbility },
      () => die,
    ),
  );
}

export function pass(state: SessionState): Extract<EngineResult, { ok: true }> {
  return ok(
    resolveAction(state, testCampaign, { kind: 'pass', actorId: actorId(state) }, () => 1),
  );
}

export function patchState(
  state: SessionState,
  edit: (draft: SessionState) => void,
): SessionState {
  const draft = structuredClone(state);
  edit(draft);
  return sessionStateSchema.parse(draft);
}
