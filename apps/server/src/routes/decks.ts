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
};

export default deckRoutes;
