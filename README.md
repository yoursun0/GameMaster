# 異境物語 / Tales Beyond

Browser-based shared-screen text RPG. See `spec.md` and `tech-design.md`.

## Requirements

- Node.js 24 LTS
- Bun (package manager and script launcher)

The application itself runs on Node, not the Bun runtime.

## Setup

1. `bun install`
2. Copy `.env.example` to `.env.local` and set `DEEPSEEK_API_KEY` locally. Do not commit that file or paste the key into chat.
3. `bun run db:migrate` and `bun run content:validate`
4. `bun run dev` and open `http://localhost:3000` (must match `APP_ORIGIN`)

Ashen Thrones is playable from the setup screen. Use a server `DEEPSEEK_API_KEY`, or set `AI_MODE=fixture` for a local scripted GM. `bun run test:live` is opt-in and not implemented until M8.

An internet connection is required for the live Game Master. Local play does not need user accounts. The play URL must match `APP_ORIGIN` exactly (`http://localhost:3000` by default), or mutations return 403.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Development server on loopback |
| `bun run build` / `bun run start` | Production build and server |
| `bun run test` | Vitest unit and integration tests |
| `bun run typecheck` / `bun run lint` | Typecheck and ESLint |
| `bun run db:migrate` | Apply SQLite migrations |
