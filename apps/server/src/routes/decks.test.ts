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
  let sharedDeckId!: string;

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
      const body = res.json();
      expect(body.name).toBe("Card Deck");
      const deckCard = await prisma.deckCard.findFirst({
        where: { deckId: body.id, cardId: testCardId },
      });
      expect(deckCard?.quantity).toBe(2);
    });

    it("upserts user — creates deck for a brand-new userId", async () => {
      const newUserId = `new-user-${Date.now()}`;
      try {
        const res = await app.inject({
          method: "POST",
          url: `/users/${newUserId}/decks`,
          payload: { name: "New User Deck" },
        });
        expect(res.statusCode).toBe(201);
      } finally {
        await prisma.deck.deleteMany({ where: { userId: newUserId } });
        await prisma.user.deleteMany({ where: { id: newUserId } });
      }
    });
  });

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

    it("deletes a deck with cards (cascade)", async () => {
      // Create a deck with a card
      const createRes = await app.inject({
        method: "POST",
        url: `/users/${testUserId}/decks`,
        payload: {
          name: "Deck With Cards",
          cards: [{ cardId: testCardId, quantity: 1 }],
        },
      });
      const { id: deckId } = createRes.json();

      const res = await app.inject({
        method: "DELETE",
        url: `/decks/${deckId}`,
      });
      expect(res.statusCode).toBe(200);

      // Verify DeckCard rows were cascaded
      const deckCards = await prisma.deckCard.findMany({ where: { deckId } });
      expect(deckCards).toHaveLength(0);
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
});
