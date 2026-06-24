import { io, type Socket } from "socket.io-client";
import { gameServerUrl } from "./config";
import type { RoomStart, HostMigrate, RoomState, Snapshot, Input } from "./protocol";

export type NetHandlers = {
  onState?: (state: RoomState) => void;
  onStart?: (data: RoomStart) => void;
  onSnapshot?: (snap: Snapshot) => void;
  onInput?: (playerId: string, input: Input, seq: number) => void;
  onHostMigrate?: (data: HostMigrate) => void;
  onDisconnect?: () => void;
};

let socket: Socket | null = null;
let inputSeq = 0;

export function getSocket(): Socket | null {
  return socket;
}

export function connectNet(handlers: NetHandlers): Socket {
  if (socket?.connected) return socket;

  socket = io(gameServerUrl(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("room:state", (data: RoomState) => handlers.onState?.(data));
  socket.on("room:start", (data: RoomStart) => handlers.onStart?.(data));
  socket.on("snapshot", (data: Snapshot) => handlers.onSnapshot?.(data));
  socket.on("input", (data: { playerId: string; seq: number; input: Input }) => {
    handlers.onInput?.(data.playerId, data.input, data.seq);
  });
  socket.on("host:migrate", (data: HostMigrate) => handlers.onHostMigrate?.(data));
  socket.on("disconnect", () => handlers.onDisconnect?.());

  return socket;
}

export function disconnectNet() {
  socket?.disconnect();
  socket = null;
  inputSeq = 0;
}

export function joinRoom(code: string, playerId: string, name: string): Promise<boolean> {
  const s = socket;
  if (!s) return Promise.resolve(false);
  return new Promise((resolve) => {
    s.emit("room:join", { code: code.toUpperCase(), playerId, name }, (ok: boolean) => {
      resolve(ok);
    });
  });
}

export function startRoom(seed: number) {
  socket?.emit("room:start", { seed });
}

export function sendInput(playerId: string, input: Input) {
  inputSeq += 1;
  socket?.emit("input", { playerId, seq: inputSeq, input });
}

export function sendSnapshot(snap: Snapshot) {
  socket?.emit("snapshot", snap);
}

export function randomPlayerId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
