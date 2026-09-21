import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createScriptedMaster, defaultNarration } from '@/server/ai/fixture';
import { ProviderError } from '@/server/ai/types';
import { openDatabase } from '@/server/db/connection';
import { migrate } from '@/server/db/migrate';
import { GameServiceError } from '@/server/game/errors';
import { GameService } from '@/server/game/service';
import { originAllowed } from '@/server/security/origin';
import { testCampaign } from '../fixtures/test-campaign';
import type Database from 'better-sqlite3';
import type { CreateSessionRequest, SubmitAction } from '@/shared/schemas';

const opened: Database.Database[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) {
    db.close();
  }
});

function service(options: ConstructorParameters<typeof GameService>[0] extends infer T ? Partial<T> : never = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rpg-m3-'));
  const db = openDatabase(join(dir, 'rpg.sqlite'));
  opened.push(db);
  migrate(db);
  const game = new GameService({
    db,
    packs: [testCampaign],
    provider: createScriptedMaster({
      interpret: {
        kind: 'check',
        approachId: 's0-insight',
        intentSummary: 'study the seal',
      },
    }),
    rollD20: () => 4,
    ...options,
  });
  return { db, game };
}

function createBody(): CreateSessionRequest {
  return {
    createRequestId: randomUUID(),
    worldId: 'test-campaign',
    locale: 'en',
    players: [
      { displayName: 'P1', characterId: 'test-guardian' },
      { displayName: 'Lya', characterId: 'test-specialist' },
      { displayName: 'P3', characterId: 'test-mediator' },
      { displayName: 'P4', characterId: 'test-scout' },
    ],
  };
}

describe('origin checks', () => {
  test('rejects a missing or mismatched Origin', () => {
    expect(originAllowed(null, 'http://localhost:3000')).toBe(false);
    expect(originAllowed('http://evil.test', 'http://localhost:3000')).toBe(false);
    expect(originAllowed('http://localhost:3000', 'http://localhost:3000')).toBe(true);
  });
});

describe('session ownership', () => {
  test('a new browser has no session', () => {
    const { game } = service();
    expect(game.getSession(null)).toEqual({ session: null });
    const owner = game.issueOwner();
    expect(game.getSession(owner).session).toBeNull();
  });

  test('creates a session and hides private content', () => {
    const { game } = service();
    const owner = game.issueOwner();
    const created = game.createSession(owner, createBody());
    expect(created.status).toBe(201);
    expect(created.session.party).toHaveLength(4);
    expect(created.session.revision).toBe(0);
    expect(created.session.pendingOperation).toBeNull();
    const serialized = JSON.stringify(created.session);
    expect(serialized).not.toContain('test-secret');
    expect(serialized).not.toContain('"flags"');
    expect(serialized).not.toContain('currentPrompt');
    expect(created.session.revealedFacts.map((fact) => fact.id)).toEqual([
      'test-public-start',
    ]);
  });

  test('two owners cannot read each other\'s operations', async () => {
    const { game } = service();
    const a = game.issueOwner();
    const b = game.issueOwner();
    const sessionA = game.createSession(a, createBody()).session;
    await game.submitAction(a, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: sessionA.party[0].playerId,
      kind: 'pass',
    });
    const preview = await game.submitAction(a, {
      operationId: randomUUID(),
      expectedRevision: 1,
      actorId: sessionA.party[1].playerId,
      kind: 'act',
      text: 'I read the seal',
      useAbility: true,
    });
    try {
      game.getOperation(b, preview.operation.id);
      throw new Error('expected missing');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('NOT_FOUND');
    }
    try {
      await game.confirmAction(b, preview.operation.id, 1);
      throw new Error('expected missing confirm');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('NOT_FOUND');
    }
  });

  test('replays an identical create and rejects a conflicting body', () => {
    const { game } = service();
    const owner = game.issueOwner();
    const body = createBody();
    const first = game.createSession(owner, body);
    const replay = game.createSession(owner, body);
    expect(replay.status).toBe(200);
    expect(replay.session.sessionId).toBe(first.session.sessionId);
    try {
      game.createSession(owner, { ...body, locale: 'zh-Hant' });
      throw new Error('expected conflict');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('IDEMPOTENCY_CONFLICT');
    }
  });

  test('requires confirmation before replacing an active adventure', () => {
    const { game } = service();
    const owner = game.issueOwner();
    game.createSession(owner, createBody());
    try {
      game.createSession(owner, createBody());
      throw new Error('expected replacement');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('REPLACEMENT_REQUIRED');
    }
  });
});

describe('operations and fencing', () => {
  test('duplicate pass id commits once', async () => {
    const { game } = service();
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    const command: SubmitAction = {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    };
    const first = await game.submitAction(owner, command);
    expect(first.session.revision).toBe(1);
    expect(first.session.turn.activePlayerId).toBe(session.party[1].playerId);
    const replay = await game.submitAction(owner, command);
    expect(replay.session.revision).toBe(1);
    expect(replay.committedRevision).toBe(1);
  });

  test('same id with a different body is a conflict', async () => {
    const { game } = service();
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    const operationId = randomUUID();
    await game.submitAction(owner, {
      operationId,
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    try {
      await game.submitAction(owner, {
        operationId,
        expectedRevision: 0,
        actorId: session.party[0].playerId,
        kind: 'ask',
        text: 'Who is at the gate?',
      });
      throw new Error('expected conflict');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('IDEMPOTENCY_CONFLICT');
    }
  });

  test('a second tab cannot start another operation while one is pending', async () => {
    const { game } = service({
      provider: createScriptedMaster({
        interpret: {
          kind: 'check',
          approachId: 's0-insight',
          intentSummary: 'study',
        },
      }),
    });
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    const preview = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 1,
      actorId: session.party[1].playerId,
      kind: 'act',
      text: 'I read the seal',
      useAbility: true,
    });
    expect(preview.operation.phase).toBe('awaiting_confirmation');
    expect(preview.session.party[1].mp).toBe(8);
    try {
      await game.submitAction(owner, {
        operationId: randomUUID(),
        expectedRevision: 1,
        actorId: session.party[1].playerId,
        kind: 'pass',
      });
      throw new Error('expected busy');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('SESSION_BUSY');
      expect((error as GameServiceError).operationId).toBe(preview.operation.id);
    }
  });

  test('stale expectedRevision is rejected for a new command', async () => {
    const { game } = service();
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    try {
      await game.submitAction(owner, {
        operationId: randomUUID(),
        expectedRevision: 0,
        actorId: session.party[1].playerId,
        kind: 'pass',
      });
      throw new Error('expected stale');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('STALE_REVISION');
    }
  });

  test('questions commit transcript without changing the turn', async () => {
    const { game } = service();
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    const result = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'ask',
      text: 'What does the seal look like?',
    });
    expect(result.session.revision).toBe(1);
    expect(result.session.turn.activePlayerId).toBe(session.party[0].playerId);
    expect(result.session.party[0].hp).toBe(14);
    expect(result.session.recentMessages.some((message) => message.kind === 'gm')).toBe(
      true,
    );
  });

  test('unrolled preview can be cancelled; a resolved roll cannot', async () => {
    const { game } = service();
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    const preview = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 1,
      actorId: session.party[1].playerId,
      kind: 'act',
      text: 'I read the seal',
      useAbility: true,
    });
    const cancelled = game.cancelAction(owner, preview.operation.id, 1);
    expect(cancelled.operation.phase).toBe('cancelled');
    expect(cancelled.session.revision).toBe(1);
    expect(cancelled.session.pendingOperation).toBeNull();
  });
});

describe('worked recovery example', () => {
  test('narration timeout keeps the roll and retry commits once', async () => {
    let narrateCalls = 0;
    const { game } = service({
      provider: createScriptedMaster({
        interpret: {
          kind: 'check',
          approachId: 's0-insight',
          intentSummary: 'Dragon Resonance',
        },
        narrate: async (context) => {
          narrateCalls += 1;
          if (narrateCalls === 1) {
            throw new ProviderError('AI_TIMEOUT', 'timeout');
          }
          return defaultNarration(context);
        },
      }),
      rollD20: () => 4,
    });
    const owner = game.issueOwner();
    const opened = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: opened.party[0].playerId,
      kind: 'pass',
    });
    const operationId = randomUUID();
    const preview = await game.submitAction(owner, {
      operationId,
      expectedRevision: 1,
      actorId: opened.party[1].playerId,
      kind: 'act',
      text: 'I attune to the seal',
      useAbility: true,
    });
    expect(preview.operation.preview?.attribute).toBe('insight');
    expect(preview.operation.preview?.abilityModifier).toBe(3);
    expect(preview.operation.preview?.mpCost).toBe(2);
    expect(preview.session.party[1].mp).toBe(8);
    expect(preview.session.revision).toBe(1);

    const timedOut = await game.confirmAction(owner, operationId, 1);
    expect(timedOut.operation.phase).toBe('retryable_error');
    expect(timedOut.operation.canRetry).toBe(true);
    expect(timedOut.operation.canCancel).toBe(false);
    expect(timedOut.session.party[1].mp).toBe(8);
    expect(timedOut.session.scene.progress).toBe(0);
    try {
      game.cancelAction(owner, operationId, 1);
      throw new Error('expected locked roll');
    } catch (error) {
      expect((error as GameServiceError).code).toBe('CANNOT_CANCEL_RESOLVED');
    }

    const committed = await game.retryAction(owner, operationId, 1);
    expect(committed.session.revision).toBe(2);
    expect(committed.committedRevision).toBe(2);
    expect(committed.session.party[1].mp).toBe(6);
    expect(committed.session.scene.progress).toBe(1);
    expect(committed.session.scene.threat).toBe(1);
    expect(committed.session.turn.activePlayerId).toBe(opened.party[2].playerId);
    expect(committed.operation.phase).toBe('committed');
    const checks = committed.session.recentMessages.filter(
      (message) => message.kind === 'check',
    );
    expect(checks).toHaveLength(1);
    expect(checks[0]?.payload).toMatchObject({
      die: 4,
      total: 11,
      outcome: 'partial',
    });
    const transcript = game.getTranscript(owner, { limit: 50 });
    expect(transcript.messages.some((message) => message.kind === 'check')).toBe(
      true,
    );

    const replay = await game.confirmAction(owner, operationId, 1);
    expect(replay.session.revision).toBe(2);
    expect(replay.session.party[1].mp).toBe(6);
    expect(narrateCalls).toBe(2);
  });
});

describe('crash interruption', () => {
  test('GET reports an interrupted operation after the lease expires', async () => {
    let now = Date.parse('2026-01-01T00:00:00.000Z');
    const { game } = service({
      now: () => new Date(now),
      leaseMs: 1_000,
      provider: createScriptedMaster({
        interpret: async () => {
          throw new ProviderError('AI_TIMEOUT', 'crash');
        },
      }),
    });
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    const failed = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 1,
      actorId: session.party[1].playerId,
      kind: 'act',
      text: 'I read the seal',
    });
    expect(failed.operation.canRetry).toBe(true);
    now += 5_000;
    const status = game.getOperation(owner, failed.operation.id);
    expect(status.operation.canRetry).toBe(true);
    expect(status.session.party[1].mp).toBe(8);
  });

  test('GET marks an expired in-flight lease interrupted without applying resources', async () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    const { game, db } = service({
      now: () => new Date(now),
      leaseMs: 1_000,
    });
    const owner = game.issueOwner();
    const session = game.createSession(owner, createBody()).session;
    await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 0,
      actorId: session.party[0].playerId,
      kind: 'pass',
    });
    const preview = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: 1,
      actorId: session.party[1].playerId,
      kind: 'act',
      text: 'I read the seal',
      useAbility: true,
    });
    db.prepare(
      `UPDATE operations SET phase = 'narrating', lease_until = ?, resolution_json = ? WHERE id = ?`,
    ).run(
      new Date(now - 5_000).toISOString(),
      JSON.stringify({ nextState: { dummy: true } }),
      preview.operation.id,
    );
    const status = game.getOperation(owner, preview.operation.id);
    expect(status.operation.phase).toBe('interrupted');
    expect(status.operation.canRetry).toBe(true);
    expect(status.operation.canCancel).toBe(false);
    expect(status.session.party[1].mp).toBe(8);
  });
});
