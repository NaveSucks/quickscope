import { createServer, request } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
// Test-only network proxy: delay/jitter both directions and discard a small
// deterministic fraction of disposable binary inputs/snapshots. Text events
// remain reliable and ordered. This models message loss, not TCP packet loss.
export async function impairmentProxy(
  upstreamPort: number,
  port: number,
  latency: () => number,
) {
  const wss = new WebSocketServer({ noServer: true }),
    connections = new Set<WebSocket>();
  const server = createServer((req, res) => {
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: upstreamPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (reply) => {
        res.writeHead(reply.statusCode || 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  server.on("upgrade", (req, socket, head) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${upstreamPort}${req.url}`, {
      headers: {
        Origin: req.headers.origin || "",
        Cookie: req.headers.cookie || "",
      },
    });
    upstream.on("unexpected-response", (_, response) => {
      socket.end(
        `HTTP/1.1 ${response.statusCode} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
      response.resume();
    });
    upstream.on("error", () => socket.destroy());
    upstream.once("open", () =>
      wss.handleUpgrade(req, socket, head, (client) => {
        connections.add(client);
        connections.add(upstream);
        let count = 0,
          inOrder = 0,
          outOrder = 0;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        function delayed(
          target: WebSocket,
          data: Buffer,
          binary: boolean,
          incoming: boolean,
        ) {
          count++;
          if (binary && count % (incoming ? 53 : 47) === 0) return;
          const due = Math.max(
            incoming ? inOrder : outOrder,
            Date.now() + latency() / 2 + ((count % 7) - 3) * 2,
          );
          if (incoming) inOrder = due;
          else outOrder = due;
          const timer = setTimeout(
            () => {
              timers.delete(timer);
              if (target.readyState === WebSocket.OPEN)
                target.send(data, { binary });
            },
            Math.max(0, due - Date.now()),
          );
          timers.add(timer);
        }
        client.on("message", (data, binary) =>
          delayed(upstream, data as Buffer, binary, false),
        );
        upstream.on("message", (data, binary) =>
          delayed(client, data as Buffer, binary, true),
        );
        function close() {
          timers.forEach(clearTimeout);
          client.terminate();
          upstream.terminate();
          connections.delete(client);
          connections.delete(upstream);
        }
        client.once("close", close);
        upstream.once("close", close);
        client.on("error", close);
      }),
    );
  });
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return async () => {
    connections.forEach((ws) => ws.terminate());
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}
