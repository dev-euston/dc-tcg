import { describe, it, expect, afterAll } from "vitest";
import prisma from "./client.js";

describe("db/client", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Card", () => {
    it("creates and reads a card", async () => {
      const slug = `test-card-${Date.now()}`;
      const card = await prisma.card.create({
        data: {
          slug,
          name: "Test Card",
          type: "CREATURE",
          setCode: "TEST",
          collectorNum: 1,
        },
      });
      expect(card.slug).toBe(slug);
      expect(card.name).toBe("Test Card");
      expect(card.type).toBe("CREATURE");
      await prisma.card.delete({ where: { id: card.id } });
    });
  });
});
