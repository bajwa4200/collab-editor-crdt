import { describe, expect, it } from "vitest";
import { createRoom, handleMessage } from "../src/server.js";
import { localInsert, toText } from "../src/crdt.js";

class MockWs {
  sent: string[] = [];
  readyState = 1;
  send(data: string) {
    this.sent.push(data);
  }
}

describe("WebSocket sync", () => {
  it("broadcasts ops to peers", () => {
    const room = createRoom("test");
    const a = new MockWs();
    const b = new MockWs();
    room.clients.add(a);
    room.clients.add(b);

    const op = localInsert(room.state, 0, "!");
    handleMessage(room, JSON.stringify({ type: "op", op }), a);

    expect(b.sent.some((m) => m.includes('"op"'))).toBe(true);
    expect(toText(room.state)).toBe("!");
  });
});
