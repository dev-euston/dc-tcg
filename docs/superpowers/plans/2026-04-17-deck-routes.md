# Deck Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add User/Deck/DeckCard Prisma models and five REST endpoints for deck CRUD so players can create and manage their card decks.

**Architecture:** A Fastify plugin (`src/routes/decks.ts`) registers all five routes and is imported into `src/index.ts`. Routes call Prisma directly via the existing singleton. No auth — `userId` is accepted as-is from the URL; the user is upserted on first deck creation so clients never need a separate user-creation step.

**Tech Stack:** Fastify 5, Prisma 7 + PrismaPg adapter, PostgreSQL, Vitest, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `apps/server/prisma/schema.prisma` | Add `User`, `Deck`, `DeckCard` models |
| Create | `apps/server/src/routes/decks.ts` | Fastify plugin — all 5 deck routes |
| Create | `apps/server/src/routes/decks.test.ts` | Integration tests for all 5 routes |
| Modify | `apps/server/src/index.ts` | Register `deckRoutes` plugin |

---

### Task 1: Update Prisma Schema and Migrate

**Files:**
- Modify: `apps/server/prisma/schema.prisma`

- [ ] **Step 1: Add User, Deck, and DeckCard models to the schema**

Replace the entire contents of `apps/server/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum CardType {
  NAMED_CREATURE
  CREATURE
  RITUAL_SPELL
  REFLEX_SPELL
  WORKSHOP_STRUCTURE
  EQUIPMENT
}

enum Keyword {
  PERSISTENT
}

model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  decks     Deck[]
}

model Deck {
  id        String     @id @default(cuid())
  name      String
  userId    String
  user      User       @relation(fields: [userId], references: [id])
  cards     DeckCard[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model DeckCard {
  id       String @id @default(cuid())
  deckId   String
  deck     Deck   @relation(fields: [deckId], references: [id], onDelete: Cascade)
  cardId   String
  card     Card   @relation(fields: [cardId], references: [id])
  quantity Int    @default(1)

  @@unique([deckId, cardId])
}

model Card {
  id           String     @id @default(cuid())
  slug         String     @unique
  name         String
  type         CardType

  costGold     Int        @default(0)
  costIron     Int        @default(0)
  costStone    Int        @default(0)
  costMana     Int        @default(0)

  notorietyReq Int?
  keywords     Keyword[]

  attack       Int?
  defense      Int?
  durability   Int?
  hp           Int?

  rulesText    String?
  flavorText   String?

  setCode      String
  collectorNum Int

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  deckCards    DeckCard[]
}
```

- [ ] **Step 2: Run the migration**

From the repo root:
```bash
pnpm db:migrate
```

When prompted for a migration name, enter: `add_user_deck_models`

Expected output:
```
Applying migration `<timestamp>_add_user_deck_models`
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/prisma/
git commit -m "[TCG-0] Add User, Deck, DeckCard Prisma models"
```

---

### Task 2: POST /users/:userId/decks — Create a Deck

**Files:**
- Create: `apps/server/src/routes/decks.ts`
- Create: `apps/server/src/routes/decks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/routes/decks.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import deckRoutes from "./decks.js";
import prisma from "../db/client.js";

const buildApp = async () => {
  const app = Fastify();
  await app.register(deckRoutes);
  await app.ready();
  return app;
};

describe("routes/decks", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let testUserId: string;
  let testCardId: string;
  let sharedDeckId: string;

  beforeAll(async () => {
    app = await buildApp();
    testUserId = `test-user-${Date.now()}`;

    // Create user and shared card for all tests
    await prisma.user.create({ data: { id: testUserId } });

    const card = await prisma.card.create({
      data: {
        slug: `test-card-decks-${Date.now()}`,
        name: "Test Card",
        type: "CREATURE",
        setCode: "TST",
        collectorNum: 99,
      },
    });
    testCardId = card.id;

    // Create a shared deck for GET/PUT/DELETE tests
    const deck = await prisma.deck.create({
      data: {
        name: "Shared Test Deck",
        userId: testUserId,
        cards: { create: [{ cardId: card.id, quantity: 1 }] },
      },
    });
    sharedDeckId = deck.id;
  });

  afterAll(async () => {
    await prisma.deck.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.card.delete({ where: { id: testCardId } });
    await app.close();
    await prisma.$disconnect();
  });

  describe("POST /users/:userId/decks", () => {
    it("creates a deck with no cards", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/users/${testUserId}/decks`,
        payload: { name: "Empty Deck" },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.name).toBe("Empty Deck");
      expect(body.userId).toBe(testUserId);
      expect(body.id).toBeDefined();
    });

    it("creates a deck with cards", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/users/${testUserId}/decks`,
        payload: {
          name: "Card Deck",
          cards: [{ cardId: testCardId, quantity: 2 }],
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe("Card Deck");
    });

    it("upserts user — creates deck for a brand-new userId", async () => {
      const newUserId = `new-user-${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: `/users/${newUserId}/decks`,
        payload: { name: "New User Deck" },
      });
      expect(res.statusCode).toBe(201);
      // Cleanup
      await prisma.deck.deleteMany({ where: { userId: newUserId } });
      await prisma.user.delete({ where: { id: newUserId } });
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: tests fail with `Cannot find module './decks.js'`

- [ ] **Step 3: Implement the route plugin**

Create `apps/server/src/routes/decks.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import prisma from "../db/client.js";

const deckRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { userId: string };
    Body: { name: string; cards?: Array<{ cardId: string; quantity: number }> };
  }>("/users/:userId/decks", async (request, reply) => {
    const { userId } = request.params;
    const { name, cards = [] } = request.body;

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const deck = await prisma.deck.create({
      data: {
        name,
        userId,
        cards: {
          create: cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
        },
      },
    });

    return reply.code(201).send(deck);
  });
};

export default deckRoutes;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected:
```
✓ routes/decks > POST /users/:userId/decks > creates a deck with no cards
✓ routes/decks > POST /users/:userId/decks > creates a deck with cards
✓ routes/decks > POST /users/:userId/decks > upserts user — creates deck for a brand-new userId
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/
git commit -m "[TCG-0] Add POST /users/:userId/decks route"
```

---

### Task 3: GET /users/:userId/decks — List Decks

**Files:**
- Modify: `apps/server/src/routes/decks.test.ts` — add describe block
- Modify: `apps/server/src/routes/decks.ts` — add route handler

- [ ] **Step 1: Add the failing tests**

Add this describe block inside the outer `describe("routes/decks", ...)` block in `decks.test.ts`, after the POST describe block:

```typescript
describe("GET /users/:userId/decks", () => {
  it("returns all decks for a user with card counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${testUserId}/decks`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]._count.cards).toBeDefined();
  });

  it("returns empty array for a userId with no decks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users/no-such-user/decks",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: 2 new failures with `404` (route not found yet).

- [ ] **Step 3: Add the route handler**

Add this handler inside the `deckRoutes` plugin in `decks.ts`, after the POST handler:

```typescript
fastify.get<{ Params: { userId: string } }>(
  "/users/:userId/decks",
  async (request, reply) => {
    const { userId } = request.params;
    const decks = await prisma.deck.findMany({
      where: { userId },
      include: { _count: { select: { cards: true } } },
    });
    return reply.send(decks);
  }
);
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/
git commit -m "[TCG-0] Add GET /users/:userId/decks route"
```

---

### Task 4: GET /decks/:deckId — Get Single Deck

**Files:**
- Modify: `apps/server/src/routes/decks.test.ts` — add describe block
- Modify: `apps/server/src/routes/decks.ts` — add route handler

- [ ] **Step 1: Add the failing tests**

Add after the GET list describe block in `decks.test.ts`:

```typescript
describe("GET /decks/:deckId", () => {
  it("returns a deck with cards and card details", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/decks/${sharedDeckId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(sharedDeckId);
    expect(body.name).toBe("Shared Test Deck");
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards[0].quantity).toBe(1);
    expect(body.cards[0].card.name).toBe("Test Card");
  });

  it("returns 404 for an unknown deckId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/decks/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Deck not found");
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: 2 new failures with `404` (route not found yet).

- [ ] **Step 3: Add the route handler**

Add after the GET list handler in `decks.ts`:

```typescript
fastify.get<{ Params: { deckId: string } }>(
  "/decks/:deckId",
  async (request, reply) => {
    const { deckId } = request.params;
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { cards: { include: { card: true } } },
    });
    if (!deck) return reply.code(404).send({ error: "Deck not found" });
    return reply.send(deck);
  }
);
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/
git commit -m "[TCG-0] Add GET /decks/:deckId route"
```

---

### Task 5: PUT /decks/:deckId — Update a Deck

**Files:**
- Modify: `apps/server/src/routes/decks.test.ts` — add describe block
- Modify: `apps/server/src/routes/decks.ts` — add route handler

- [ ] **Step 1: Add the failing tests**

Add after the GET single describe block in `decks.test.ts`:

```typescript
describe("PUT /decks/:deckId", () => {
  it("renames a deck", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/decks/${sharedDeckId}`,
      payload: { name: "Renamed Deck" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Renamed Deck");
  });

  it("replaces cards in a deck", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/decks/${sharedDeckId}`,
      payload: {
        cards: [{ cardId: testCardId, quantity: 3 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].quantity).toBe(3);
  });

  it("returns 404 for an unknown deckId", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/decks/nonexistent-id",
      payload: { name: "Ghost Deck" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Deck not found");
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: 3 new failures with `404` (route not found yet).

- [ ] **Step 3: Add the route handler**

Add after the GET single handler in `decks.ts`:

```typescript
fastify.put<{
  Params: { deckId: string };
  Body: { name?: string; cards?: Array<{ cardId: string; quantity: number }> };
}>("/decks/:deckId", async (request, reply) => {
  const { deckId } = request.params;
  const { name, cards } = request.body;

  const existing = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!existing) return reply.code(404).send({ error: "Deck not found" });

  if (cards !== undefined) {
    await prisma.deckCard.deleteMany({ where: { deckId } });
  }

  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: {
      ...(name !== undefined && { name }),
      ...(cards !== undefined && {
        cards: {
          create: cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
        },
      }),
    },
    include: { cards: { include: { card: true } } },
  });

  return reply.send(deck);
});
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/
git commit -m "[TCG-0] Add PUT /decks/:deckId route"
```

---

### Task 6: DELETE /decks/:deckId — Delete a Deck

**Files:**
- Modify: `apps/server/src/routes/decks.test.ts` — add describe block
- Modify: `apps/server/src/routes/decks.ts` — add route handler

- [ ] **Step 1: Add the failing tests**

Add after the PUT describe block in `decks.test.ts`:

```typescript
describe("DELETE /decks/:deckId", () => {
  it("deletes a deck and returns success", async () => {
    // Create a throwaway deck to delete
    const createRes = await app.inject({
      method: "POST",
      url: `/users/${testUserId}/decks`,
      payload: { name: "To Be Deleted" },
    });
    const { id: deckId } = createRes.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/decks/${deckId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });

    // Verify deck is gone
    const gone = await prisma.deck.findUnique({ where: { id: deckId } });
    expect(gone).toBeNull();
  });

  it("returns 404 for an unknown deckId", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/decks/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Deck not found");
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: 2 new failures with `404` (route not found yet).

- [ ] **Step 3: Add the route handler**

Add after the PUT handler in `decks.ts`:

```typescript
fastify.delete<{ Params: { deckId: string } }>(
  "/decks/:deckId",
  async (request, reply) => {
    const { deckId } = request.params;
    const existing = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!existing) return reply.code(404).send({ error: "Deck not found" });

    await prisma.deck.delete({ where: { id: deckId } });
    return reply.send({ success: true });
  }
);
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @dungeon-crystal/server test -- src/routes/decks.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/
git commit -m "[TCG-0] Add DELETE /decks/:deckId route"
```

---

### Task 7: Register Routes in index.ts

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Register the deck routes plugin**

Replace the contents of `apps/server/src/index.ts` with:

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";
import deckRoutes from "./routes/decks.js";

const PORT = Number(process.env.PORT ?? 2567);

async function main() {
  const app = Fastify();
  await app.register(cors);
  await app.register(deckRoutes);

  const gameServer = new Server({ server: app.server });
  gameServer.define("game_room", GameRoom);

  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Game server listening on http://localhost:${PORT}`);
}

main();
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
pnpm --filter @dungeon-crystal/server test
```

Expected: all tests pass, including `db/client.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "[TCG-0] Register deck routes in server"
```
