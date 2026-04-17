# Deck Routes Design

**Date:** 2026-04-17
**Status:** Approved

## Overview

Add deck management to the Dungeon Crystal server. Players can create and manage decks of cards. A deck is a named collection of cards owned by a user. Cards within a deck are tracked with a quantity (up to 3 per card for non-Named, 1 for Named — not enforced at API level for now to support varied game modes).

## Data Model

Three new Prisma models in `apps/server/prisma/schema.prisma`:

```prisma
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
```

- `onDelete: Cascade` on `DeckCard` — deleting a deck automatically removes its card rows
- `@@unique([deckId, cardId])` — one row per card per deck; quantity tracks the count
- `User` is minimal for now; fields will be added later alongside auth

## Routes

All routes registered as a Fastify plugin in `src/routes/decks.ts`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/users/:userId/decks` | Create a new deck |
| `GET` | `/users/:userId/decks` | List all decks for a user |
| `GET` | `/decks/:deckId` | Get a single deck with full card list |
| `PUT` | `/decks/:deckId` | Update deck name and/or cards |
| `DELETE` | `/decks/:deckId` | Delete a deck |

### Request/Response Shapes

**POST `/users/:userId/decks`**
```json
// Request body
{ "name": "My Deck", "cards": [{ "cardId": "cuid", "quantity": 2 }] }

// Response 201
{ "id": "cuid", "name": "My Deck", "userId": "cuid", "createdAt": "...", "updatedAt": "..." }
```

**GET `/users/:userId/decks`**
```json
// Response 200
[{ "id": "cuid", "name": "My Deck", "userId": "cuid", "_count": { "cards": 3 } }]
```

**GET `/decks/:deckId`**
```json
// Response 200
{
  "id": "cuid",
  "name": "My Deck",
  "userId": "cuid",
  "cards": [{ "cardId": "cuid", "quantity": 2, "card": { "id": "...", "name": "...", "type": "..." } }]
}
```

**PUT `/decks/:deckId`**
```json
// Request body (all fields optional)
{ "name": "Renamed Deck", "cards": [{ "cardId": "cuid", "quantity": 1 }] }

// Response 200 — same shape as GET /decks/:deckId
```

Cards are fully replaced on PUT (delete all existing DeckCard rows, insert new ones). Simpler than diffing for now.

**DELETE `/decks/:deckId`**
```json
// Response 200
{ "success": true }
```

## File Structure

```
apps/server/src/
  routes/
    decks.ts       — Fastify plugin with all 5 deck routes
  index.ts         — register deckRoutes plugin (existing file, small addition)
prisma/
  schema.prisma    — add User, Deck, DeckCard models (existing file)
```

Routes call Prisma directly via the existing singleton in `src/db/client.ts`. No additional abstraction layer.

## Out of Scope

- Deck construction rule enforcement (40-card limit, copy limits) — deferred; game modes may vary
- Shuffle endpoint — belongs to game room / Colyseus gameplay, not deck storage
- Auth / JWT validation — `userId` is accepted as-is; auth will be layered in later
- User creation endpoint — users are created implicitly or via a future auth flow
