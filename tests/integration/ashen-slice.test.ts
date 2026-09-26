import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createScriptedMaster } from '@/server/ai/fixture';
import { ashenThrones } from '@/server/content/worlds/ashen-thrones';
import { openDatabase } from '@/server/db/connection';
import { migrate } from '@/server/db/migrate';
import { GameService } from '@/server/game/service';
import type Database from 'better-sqlite3';
import type { Locale } from '@/shared/schemas';

const opened: Database.Database[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) {
    db.close();
  }
});

function sliceService() {
  const dir = mkdtempSync(join(tmpdir(), 'rpg-m5-'));
  const db = openDatabase(join(dir, 'rpg.sqlite'));
  opened.push(db);
  migrate(db);
  const game = new GameService({
    db,
    packs: [ashenThrones],
    provider: createScriptedMaster({
      interpret: (context) => ({
        kind: 'check',
        approachId:
          context.availableApproachIds.find((id) => id.endsWith('-insight')) ??
          context.availableApproachIds[0] ??
          'ash-s0-insight',
        intentSummary: context.text.slice(0, 80),
      }),
    }),
    rollD20: () => 20,
  });
  return game;
}

async function playToEnding(locale: Locale) {
  const game = sliceService();
  const owner = game.issueOwner();
  const created = game.createSession(owner, {
    createRequestId: randomUUID(),
    worldId: 'ashen-thrones',
    locale,
    players: [{ displayName: 'Lya', characterId: 'ash-scholar' }],
  });
  expect(created.status).toBe(201);
  expect(created.session.world.id).toBe('ashen-thrones');
  expect(created.session.recentMessages.some((message) => message.kind === 'gm')).toBe(
    true,
  );
  const opening = JSON.stringify(created.session);
  expect(opening).not.toContain('ash-truth-altered-genealogy');
  expect(opening).not.toContain('justify a purge');

  let session = created.session;
  const firstAct = await game.submitAction(owner, {
    operationId: randomUUID(),
    expectedRevision: session.revision,
    actorId: session.turn.activePlayerId,
    kind: 'act',
    text: 'I study the Greywing seal.',
    useAbility: true,
  });
  expect(firstAct.operation.phase).toBe('awaiting_confirmation');
  expect(firstAct.operation.preview?.attribute).toBeDefined();
  expect(firstAct.session.party[0]?.mp).toBe(session.party[0]?.mp);

  const confirmed = await game.confirmAction(
    owner,
    firstAct.operation.id,
    firstAct.session.revision,
  );
  expect(confirmed.operation.phase).toBe('committed');
  expect(confirmed.session.revision).toBeGreaterThan(session.revision);
  session = game.getSession(owner).session!;
  expect(session.sessionId).toBe(created.session.sessionId);

  let guard = 0;
  while (session.status === 'active') {
    guard += 1;
    if (guard > 40) {
      throw new Error('Ashen Thrones did not end');
    }
    if (session.pendingOperation?.phase === 'awaiting_confirmation') {
      const next = await game.confirmAction(
        owner,
        session.pendingOperation.id,
        session.revision,
      );
      session = next.session;
      continue;
    }
    const result = await game.submitAction(owner, {
      operationId: randomUUID(),
      expectedRevision: session.revision,
      actorId: session.turn.activePlayerId,
      kind: 'act',
      text: session.suggestions[0]?.text ?? 'I press on.',
    });
    session = result.session;
  }

  expect(session.status).toBe('completed');
  expect(session.ending?.kind).toBeTruthy();
  expect(session.ending?.epilogues).toHaveLength(1);
  const reloaded = game.getSession(owner).session;
  expect(reloaded?.status).toBe('completed');
  expect(reloaded?.ending?.summary).toBe(session.ending?.summary);
  expect(JSON.stringify(session)).toContain('ash-truth-altered-genealogy');
  return session;
}

describe('Ashen Thrones vertical slice', () => {
  test('English setup through ending survives reload', async () => {
    const session = await playToEnding('en');
    expect(session.locale).toBe('en');
    expect(session.ending?.summary).toMatch(/[A-Za-z]/);
  });

  test('Traditional Chinese setup through ending survives reload', async () => {
    const session = await playToEnding('zh-Hant');
    expect(session.locale).toBe('zh-Hant');
    expect(session.ending?.summary).toMatch(/[\u4e00-\u9fff]/);
  });
});
