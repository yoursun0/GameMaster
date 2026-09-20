import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

const cache = globalThis as typeof globalThis & {
  __talesBeyondDb?: SqliteDatabase;
  __talesBeyondDbPath?: string;
};

export function openDatabase(path: string): SqliteDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function getDatabase(path: string): SqliteDatabase {
  if (cache.__talesBeyondDb && cache.__talesBeyondDbPath === path) {
    return cache.__talesBeyondDb;
  }
  cache.__talesBeyondDb?.close();
  const db = openDatabase(path);
  cache.__talesBeyondDb = db;
  cache.__talesBeyondDbPath = path;
  return db;
}
