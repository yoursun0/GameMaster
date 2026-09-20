# Implementation log

## Completed

- **M1 — Scaffold and persistence bootstrap** (2026-09-21)

## Verification

| Check | Result |
| --- | --- |
| `bun run test` | 11 passed (env, health, credential isolation, first+repeat migration, malformed migration rollback) |
| `bun run typecheck` | Pass (`tsc --noEmit`) |
| `bun run lint` | Pass (ESLint 9.39.5 + `eslint-config-next`) |
| `bun run build` | Pass (Next.js 16.3.5, Node). Routes compile; session/action handlers are dynamic. |
| Client bundle | `.next/static` scanned; no `DEEPSEEK_API_KEY` and no configured key value |
| `bun run start` | `http://127.0.0.1:3000` ready. `GET /` and `/play` 200. `GET /api/health` → `{status:"ok",aiConfigured:true}` with no secrets. `GET /api/session` → 501 + `Cache-Control: no-store`. |
| `bun run dev` | Ready on `127.0.0.1:3000`. Health and home page served. |
| `bun run db:migrate` twice | Temporary `data/rpg-m1.sqlite` migrated twice with no error |

Pinned toolchain: Node 24.14.0, Bun 1.4.2, Next 16.3.5, React 19.3.0, TypeScript 5.9.3, ESLint 9.39.5, better-sqlite3 13.0.3. TypeScript 7 and ESLint 10 were rejected: `typescript-eslint` does not support TS 7, and `eslint-plugin-react` does not support ESLint 10.

`better-sqlite3` loaded under Node without extra trusted-dependency configuration. CLI scripts that import `server-only` modules use `scripts/shim-server-only.mjs`.

## Known gaps

- Setup wizard, rules engine, sessions, DeepSeek adapter, world packs, and production GUI are not started (M2–M8).
- Empty game/session/action/catalog/transcript routes return `501 NOT_IMPLEMENTED`.
- `bun run content:validate` and `bun run test:live` exit 1 by design until M6/M8.
- No Playwright cases yet; `test:e2e` has an empty suite.
- Landing/play pages are placeholders using option-1 tokens, not the full Chronicle GUI.
- Live provider verification is not part of M1.
- `content:validate` is in the documented setup sequence but exits 1 until M6 world packs exist.

## Next

M2: shared schemas, rules, round handling, scene progression, content validator.
