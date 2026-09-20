import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase } from '@/server/db/connection';
import { migrate } from '@/server/db/migrate';
import type Database from 'better-sqlite3';

const opened: Database.Database[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) {
    db.close();
  }
});

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'rpg-migrate-'));
}

function open(path: string): Database.Database {
  const db = openDatabase(path);
  opened.push(db);
  return db;
}

function tableNames(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

describe('database migration', () => {
  test('opens a nested temporary database and migrates twice safely', () => {
    const dir = tempDir();
    const dbPath = join(dir, 'nested', 'rpg.sqlite');
    const db = open(dbPath);

    migrate(db);
    migrate(db);

    expect(tableNames(db)).toEqual([
      'browser_owners',
      'messages',
      'operations',
      'schema_migrations',
      'sessions',
    ]);

    const versions = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all();
    expect(versions).toEqual([{ version: 1 }]);

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');

    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    expect(indexes.map((row) => row.name)).toEqual([
      'messages_by_session_seq',
      'one_active_session_per_owner',
      'one_unfinished_operation_per_session',
      'operations_by_session',
    ]);
  });

  test('malformed migration rolls back and does not record its version', () => {
    const dir = tempDir();
    const migrationsDir = join(dir, 'migrations');
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, '001-ok.sql'),
      'CREATE TABLE widgets (id TEXT PRIMARY KEY);',
    );
    writeFileSync(
      join(migrationsDir, '002-bad.sql'),
      'CREATE TABLE broken (id TEXT PRIMARY KEY;',
    );

    const db = open(join(dir, 'rpg.sqlite'));
    expect(() => migrate(db, migrationsDir)).toThrow();

    expect(tableNames(db)).toEqual(['schema_migrations', 'widgets']);
    expect(
      db.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
    ).toEqual([{ version: 1 }]);
    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'broken'`).get(),
    ).toBeUndefined();
  });
});
