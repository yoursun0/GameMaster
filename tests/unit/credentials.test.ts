import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

describe('credential isolation', () => {
  test('server env is marked server-only', () => {
    const source = readFileSync(join('src', 'server', 'env.ts'), 'utf8');
    expect(source).toMatch(/import ['"]server-only['"]/);
  });

  test('no client-exposed DeepSeek credential variables exist', () => {
    const files = [
      ...walk('src/app'),
      ...walk('src/components'),
      ...walk('src/shared'),
      ...walk('src/styles'),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/NEXT_PUBLIC_DEEPSEEK/);
      expect(text, file).not.toMatch(/DEEPSEEK_API_KEY/);
    }
  });
});
