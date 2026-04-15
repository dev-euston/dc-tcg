import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT ?? 2567);
const IS_DEV = process.env.NODE_ENV !== "production";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });

// Register rooms
gameServer.define("game_room", GameRoom);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Colyseus monitor (dev only)
if (IS_DEV) {
  app.use("/colyseus", monitor());
}

gameServer.listen(PORT).then(() => {
  console.log(`Game server listening on http://localhost:${PORT}`);
  if (IS_DEV) {
    console.log(`Colyseus monitor at http://localhost:${PORT}/colyseus`);
  }
});
