import { getWorldPacks } from '../src/server/content/index';
import { ContentValidationError, validateWorldPacks } from '../src/server/content/validate';

const packs = getWorldPacks();
try {
  validateWorldPacks(packs);
  process.stdout.write(`Validated ${packs.length} world pack(s).\n`);
} catch (error) {
  if (error instanceof ContentValidationError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
