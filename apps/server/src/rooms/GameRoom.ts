import { Room, Client } from "colyseus";
import { Schema, type } from "@colyseus/schema";

class GameState extends Schema {
  @type("string") status: string = "waiting";
}

export class GameRoom extends Room<GameState> {
  maxClients = 2;

  onCreate() {
    this.setState(new GameState());
    console.log(`[GameRoom] created — id: ${this.roomId}`);
  }

  onJoin(client: Client) {
    console.log(`[GameRoom] ${client.sessionId} joined`);
  }

  onLeave(client: Client) {
    console.log(`[GameRoom] ${client.sessionId} left`);
  }

  onDispose() {
    console.log(`[GameRoom] ${this.roomId} disposed`);
  }
}
