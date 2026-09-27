# Implementation log

## Completed

- **M1 — Scaffold and persistence bootstrap** (2026-09-21)
- **M2 — Rules engine, schemas, and content validator** (2026-09-21)
- **M3 — Browser identity, sessions, projection, and operation fencing** (2026-09-21)
- **M4 — DeepSeek adapter, prompts, context, and fixture provider tests** (2026-09-21)
- **M5 — Ashen Thrones vertical slice (EN + 繁中) through real routes** (2026-09-21)

## M5 verification

| Check | Result |
| --- | --- |
| `bun run test` | 85 passed, including Ashen Thrones validation and EN/ZH setup→preview→check→ending→reload |
| `bun run content:validate` | Passes (1 world pack) |
| `bun run typecheck` / `bun run lint` | Pass |

## M4 verification

| Check | Result |
| --- | --- |
| `bun run test` | 81 passed, including DeepSeek adapter cases for valid JSON, narration, fenced/non-JSON, extra keys, malformed types, unknown IDs, empty content, truncated completion, timeout without key leak, 401, 429, 5xx retry, sentinel secrecy until reveal, loopback fixture gate, and no production fixture fallback |
| `bun run typecheck` / `bun run lint` | Pass |

## M3 verification

| Check | Result |
| --- | --- |
| `bun run test` | 64 passed, including 14 integration tests: ownership isolation, create idempotency/replacement, duplicate suppression, stale revision, pending busy, question transcript, cancel preview, §8.6 narration-timeout recovery, lease interrupt |
| `bun run typecheck` / `bun run lint` | Pass |

## M2 verification

| Check | Result |
| --- | --- |
| `bun run test` | 46 passed: checks, ability/MP, conditions, resources, help/items/rest, overwhelm, 1–4 player turns, all-pass, two-round setback, remaining-seat close, progress/threat conflict, ending formula, route last-wins/default, repeat-approach unlock, eight-scene solo success and four-player failure |
| `bun run typecheck` / `bun run lint` | Pass |
| `bun run content:validate` | Exits 1: no production world packs yet (M5/M6) |

## M1 verification

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

- Live DeepSeek smoke tests are not run (need authorization and a configured key). HTTP create still returns `AI_NOT_CONFIGURED` when no server key is set and fixture mode is off.
- Remaining three worlds are not authored (M6).
- Production GUI is not started (M7).
- `bun run test:live` exits 1 until M8.
- No Playwright cases yet.
- Process-local provider concurrency (2) and session-create IP buckets are not fully exercised.

## Next

M6: remaining three complete world packs and bilingual character content.
