import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `ws://${location.hostname}:8787?room=default`;

export default function App() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const suppressRef = useRef(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      ws.send(JSON.stringify({ type: "sync_request" }));
    };
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as {
        type: string;
        text?: string;
        op?: { type: string; char?: string; pos: string };
      };
      if (msg.type === "sync" && typeof msg.text === "string") {
        suppressRef.current = true;
        setText(msg.text);
        suppressRef.current = false;
      }
      if (msg.type === "op" && msg.op?.type === "insert" && msg.op.char) {
        suppressRef.current = true;
        setText((t) => t + msg.op!.char);
        suppressRef.current = false;
      }
    };

    return () => ws.close();
  }, []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setText(next);
    if (suppressRef.current || !wsRef.current || wsRef.current.readyState !== 1) {
      return;
    }
    const added = next.slice(text.length);
    if (added) {
      for (const char of added) {
        const pos = `c${Date.now()}-${Math.random()}`;
        wsRef.current.send(
          JSON.stringify({
            type: "op",
            op: {
              type: "insert",
              pos,
              char,
              time: [Date.now(), "client"],
            },
          }),
        );
      }
    }
  }, [text]);

  return (
    <div className="app">
      <h1>Collab Editor (CRDT)</h1>
      <textarea value={text} onChange={onChange} placeholder="Start typing…" />
      <p className="status">Status: {status}</p>
    </div>
  );
}
