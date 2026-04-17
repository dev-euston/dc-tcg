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
