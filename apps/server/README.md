# @dungeon-crystal/server

Game server for Dungeon Crystal TCG — Colyseus 0.15 + Fastify, TypeScript.

## Stack

| | |
|---|---|
| Real-time | Colyseus 0.15 (WebSocket rooms) |
| HTTP | Fastify 5 |
| Language | TypeScript 5, Node 20 |
| Dev runner | `tsx watch` |

## Development

```bash
# From repo root
pnpm --filter @dungeon-crystal/server dev

# Or from this directory
pnpm dev
```

Server starts on **http://localhost:2567**.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check → `{"status":"ok"}` |
| `GET /matchmake/` | Colyseus built-in matchmaking API |
| `ws://localhost:2567` | WebSocket entry point |

## Structure

```
src/
  index.ts          — Fastify + Colyseus server bootstrap
  rooms/
    GameRoom.ts     — Colyseus Room (game state, join/leave lifecycle)
  game/             — Pure game logic (rules engine, state machines)
  db/               — Prisma client and query helpers
```

## Building

```bash
pnpm build   # emits to dist/
pnpm start   # runs dist/index.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2567` | Port to listen on |
