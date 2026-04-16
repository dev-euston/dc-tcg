# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dungeon Crystal** is a digital TCG (Trading Card Game) playable on web and mobile. The stack:

- **Monorepo:** pnpm workspaces + Turborepo
- **`apps/server`** (`@dungeon-crystal/server`) — Colyseus 0.15 + Fastify, TypeScript, `tsx` for dev. Runs on port 2567.
- **`apps/ui-web`** (`@dungeon-crystal/ui-web`) — Vite 6 + React 18 + TypeScript. Runs on port 3000.
- **`apps/mobile`** — future; not in active scope
- **Auth/DB:** Supabase CLI (`supabase start`) — Postgres on port 54322, API on 54321, Studio on 54323 (auth layer)
- **Game DB:** Docker Compose Postgres on port **5632** — used by Prisma for game data. Copy `apps/server/.env.example` → `apps/server/.env` before running Prisma commands.
- **Docker Compose:** manages the Postgres game DB (port 5632) and app containers (server + ui-web)

## Common Commands

```bash
# Root (runs all apps via Turborepo)
pnpm dev          # start all apps in dev mode
pnpm build        # build all apps
pnpm lint         # lint all apps
pnpm test         # run all tests

# Per-app
pnpm --filter @dungeon-crystal/server dev
pnpm --filter @dungeon-crystal/ui-web dev

# Prisma (root shortcuts available)
pnpm db:migrate   # apply schema changes + regenerate client
pnpm db:generate  # regenerate client only
pnpm db:studio    # visual DB browser

# Supabase (local infra)
supabase start    # spin up Postgres, Auth, Studio
supabase stop
supabase db reset # re-run all migrations

# Docker (app containers only)
docker compose up --build
```

## pnpm / Monorepo Notes

- `.npmrc` sets `public-hoist-pattern[]=@types/*` so all `@types` packages are hoisted to root `node_modules`. This is required for VS Code's TypeScript language server (which runs from the workspace root) to find type declarations. After any `pnpm install`, types will be at both `apps/server/node_modules/@types/` and `node_modules/@types/`.
- `skipLibCheck: true` is intentional in `apps/server/tsconfig.json` — Colyseus 0.15 and `@colyseus/schema` have errors in their own declaration files that are not ours to fix.

## Architecture

### Server (`apps/server`)

Colyseus rooms handle all real-time game state. Fastify handles REST (health, auth webhooks). Use **Prisma** for all DB access — no raw SQL.

- `src/rooms/` — Colyseus Room classes. Each room owns its `GameState` schema.
- `src/game/` — pure game logic (rules engine, state machines) decoupled from Colyseus transport
- `src/db/` — Prisma client instantiation and query helpers; `client.ts` exports a default singleton
- `prisma/schema.prisma` — single source of truth for DB schema; run `pnpm db:migrate` to apply changes
- `prisma.config.ts` — **Prisma 7 config** (datasource URL for CLI; loads `.env` via dotenv)
- **Prisma 7 note:** `url` is NOT in `schema.prisma` — it lives in `prisma.config.ts` under `datasource.url`. `PrismaClient` requires a `PrismaPg` adapter (`@prisma/adapter-pg`) passed at construction time. Both `prisma.config.ts` and `vitest.config.ts` load `.env` via dotenv explicitly.
- Colyseus matchmaking API at `/matchmake/` (built-in, always available)
- `GET /health` → `{"status":"ok"}`

### Web UI (`apps/ui-web`)

- Vite 6 + React 18 + TypeScript; package name `@dungeon-crystal/ui-web`
- Use **Tailwind CSS v4** (`@tailwindcss/vite` plugin, no `tailwind.config.js`) for all layout/page-level code
- Design tokens registered in `@theme` block in `src/index.css` — use as Tailwind classes: `text-essence`, `bg-surface`, `font-ui`, etc.
- Use **inline styles** (not Tailwind) for any UI where colors are dynamic runtime values (e.g. card type colours)

### Tailwind Design Tokens (defined in `apps/ui-web/src/index.css`)

```
--color-essence, --color-gold, --color-stone, --color-iron, --color-generic
--color-bg, --color-surface, --color-border, --color-text, --color-text-muted
--font-display (Cinzel Decorative), --font-ui (Cinzel), --font-body (Crimson Pro)
```

## Game Rules (authoritative — use when implementing rules engine)

### Win / Loss
- First to **25 Essence** wins (active player wins on tie)
- Lose immediately on required draw from an **empty deck**

### Resources
- **Gold, Iron, Stone, Mana** — four resource types (Mana is purple, for spells)
- **Essence** — score counter only; cannot be raided or stolen
- **Siphon:** each unblocked raider = +1 Essence to attacker
- **Global Overdrive:** triggers at 15 Essence (any player); all Mining permanently produces 2

### Turn Structure
- Draw 2 cards; P1 skips first draw
- Opening hand: draw 7, keep 5, bottom 2
- Hand max: 7 — draw first, discard to 7 at end of turn
- Starting resources: P1 `1G/1I/1S/1M/3 Workers`; P2 `2G/1I/1S/2M/3 Workers`

### Combat
- ⚔ ≥ 🛡 = destroyed; damage is simultaneous
- Gang block: combined 🛡, individual ⚔ checks
- Fortifications block with HP (not 🛡); take ⚔ damage per block; deal no damage back; one Fortification per Raider; destroyed at 0 HP

### Deck Construction
- 40 cards; Named cards max 1 copy; non-Named max 3 copies; Best-of-1, no sideboard

### Influence
- Starts at 0, max 10; +1 after any raid where at least one Raider Siphons or steals resources

### Keywords
- Only two: **Notoriety** (♛ X) and **Persistent** (∞)

### Equipment
- Lives in **Permanent Zone** when unattached
- Equipped creature destroyed → equipment returns to owner's Permanent Zone
- Raider destroyed in combat → equipment goes to **defending player's** Permanent Zone (loot)
- 0 Durability → destroyed to owner's discard
- Can be scrapped during Main Phase for 1 Iron (removed from game)

## Card Data Model

Card types: `Named Creature`, `Creature`, `Ritual Spell`, `Reflex Spell`, `Workshop Structure`, `Equipment`

Key fields: `notorietyReq` (drives ♛ display), `keywords` (array — only `PERSISTENT` renders ∞), cost pips use type `MANA` (not `ESSENCE`).

Card layout top→bottom: name bar → cost row → art box (arch-top; rectangular for Equipment) → type line → keyword bar → text box → stats bar → collector strip.

## Supabase Local Credentials

```
Postgres:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
API:       http://127.0.0.1:54321
Studio:    http://127.0.0.1:54323
```

OAuth secrets read via `env()` substitution in `supabase/config.toml`.
