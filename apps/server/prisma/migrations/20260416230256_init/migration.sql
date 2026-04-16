-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('NAMED_CREATURE', 'CREATURE', 'RITUAL_SPELL', 'REFLEX_SPELL', 'WORKSHOP_STRUCTURE', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "Keyword" AS ENUM ('PERSISTENT');

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "costGold" INTEGER NOT NULL DEFAULT 0,
    "costIron" INTEGER NOT NULL DEFAULT 0,
    "costStone" INTEGER NOT NULL DEFAULT 0,
    "costMana" INTEGER NOT NULL DEFAULT 0,
    "notorietyReq" INTEGER,
    "keywords" "Keyword"[],
    "attack" INTEGER,
    "defense" INTEGER,
    "durability" INTEGER,
    "hp" INTEGER,
    "rulesText" TEXT,
    "flavorText" TEXT,
    "setCode" TEXT NOT NULL,
    "collectorNum" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_slug_key" ON "Card"("slug");
