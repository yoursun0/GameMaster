import 'server-only';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqliteDatabase } from './connection';

const MIGRATION_FILE = /^(\d+)-.+\.sql$/;

export function defaultMigrationsDir(): string {
  return join(process.cwd(), 'src', 'server', 'db', 'migrations');
}

export function migrate(
  db: SqliteDatabase,
  migrationsDir: string = defaultMigrationsDir(),
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const hasVersion = db.prepare(
    'SELECT 1 AS ok FROM schema_migrations WHERE version = ?',
  );
  const recordVersion = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    const match = file.match(MIGRATION_FILE);
    if (!match) {
      throw new Error(`Invalid migration filename: ${file}`);
    }

    const version = Number(match[1]);
    if (hasVersion.get(version)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      recordVersion.run(version, new Date().toISOString());
    });
    apply();
  }
}
