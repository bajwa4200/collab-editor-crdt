import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  applyRemote,
  createState,
  toText,
  type CrdtOp,
  type CrdtState,
} from "./crdt.js";

export interface Room {
  id: string;
  state: CrdtState;
  clients: Set<WebSocket>;
}

export function createRoom(id: string): Room {
  return {
    id,
    state: createState(`server-${id}`),
    clients: new Set(),
  };
}

const rooms = new Map<string, Room>();

export function getOrCreateRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = createRoom(id);
    rooms.set(id, room);
  }
  return room;
}

function parseRoomId(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get("room") ?? "default";
}

export function broadcast(room: Room, payload: unknown, except?: WebSocket): void {
  const msg = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client !== except && client.readyState === 1) {
      client.send(msg);
    }
  }
}

export function handleMessage(room: Room, raw: string, ws: WebSocket): void {
  let data: { type: string; op?: CrdtOp };
  try {
    data = JSON.parse(raw) as { type: string; op?: CrdtOp };
  } catch {
    return;
  }

  if (data.type === "sync_request") {
    ws.send(JSON.stringify({ type: "sync", text: toText(room.state) }));
    return;
  }

  if (data.type === "op" && data.op) {
    applyRemote(room.state, data.op);
    broadcast(room, { type: "op", op: data.op }, ws);
  }
}

export function startServer(port = 8787): ReturnType<typeof createServer> {
  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("collab-editor-crdt websocket server\n");
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    const roomId = parseRoomId(req);
    const room = getOrCreateRoom(roomId);
    room.clients.add(ws);

    ws.on("message", (buf) => handleMessage(room, buf.toString(), ws));
    ws.on("close", () => room.clients.delete(ws));

    ws.send(JSON.stringify({ type: "hello", room: roomId }));
  });

  httpServer.listen(port);
  return httpServer;
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  startServer(port);
  console.log(`WebSocket server on ws://localhost:${port}`);
}
