# Dungeon Crystal TCG

A digital trading card game playable on web and mobile.

## Monorepo Structure

```
apps/
  server/   — Game server (Colyseus + Express + Prisma)
  ui-web/   — Web client (Vite + React)
packages/   — Shared packages (types, utilities)
supabase/   — Supabase config and migrations
```

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+
- [Docker](https://www.docker.com) (for containerised dev)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local auth/DB)

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy server env (needed for Prisma)
cp apps/server/.env.example apps/server/.env

# Start game DB (Postgres via Docker Compose)
docker compose up -d postgres

# Start local Supabase (Auth + Studio)
supabase start

# Start all apps in dev mode
pnpm dev
```

| Service         | URL / connection                                             |
|-----------------|--------------------------------------------------------------|
| Web client      | http://localhost:3000                                        |
| Game server     | http://localhost:2567                                        |
| Colyseus monitor| http://localhost:2567/colyseus                               |
| Game DB (Prisma)| postgresql://postgres:postgres@localhost:5632/dungeon_crystal |
| Supabase Studio | http://localhost:54323                                       |
| Supabase API    | http://localhost:54321                                       |

## Common Commands

```bash
pnpm dev           # start all apps
pnpm build         # build all apps
pnpm lint          # lint all apps
pnpm test          # run all tests

# Run a single app
pnpm --filter @dungeon-crystal/server dev
pnpm --filter @dungeon-crystal/ui-web dev

# Database (Prisma — run from apps/server)
pnpm --filter @dungeon-crystal/server prisma migrate dev
pnpm --filter @dungeon-crystal/server prisma studio

# Supabase
supabase start
supabase stop
supabase db reset
```

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Server     | Colyseus 0.15, Express, TypeScript |
| ORM        | Prisma                            |
| Auth / DB  | Supabase (Postgres)               |
| Web UI     | Vite 6, React 18, TypeScript      |
| Styling    | Tailwind CSS v4                   |
| Monorepo   | pnpm workspaces, Turborepo        |
