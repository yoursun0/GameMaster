import { getDatabase } from '../src/server/db/connection';
import { migrate } from '../src/server/db/migrate';
import { getEnv } from '../src/server/env';

const env = getEnv();
const db = getDatabase(env.DATABASE_PATH);
migrate(db);
process.stdout.write(`Migrated ${env.DATABASE_PATH}\n`);
