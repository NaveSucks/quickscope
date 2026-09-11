import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import { WebSocketServer, WebSocket } from "ws";
import { resolve } from "node:path";
import { Auth } from "./auth.ts";
import { gate } from "./gate.ts";
import { Room } from "./room.ts";
import { decodeInput, encodeSnapshot } from "../shared/protocol.ts";
export async function createApp(
  hash: string,
  origin: string,
  staticRoot = resolve("dist"),
) {
  const auth = new Auth(hash, origin),
    room = new Room(),
    app = Fastify({ logger: false, bodyLimit: 1024, trustProxy: true }),
    wss = new WebSocketServer({
      noServer: true,
      maxPayload: 1024,
      perMessageDeflate: false,
    });
  const sockets = new Map<number, WebSocket>();
  const outgoing = new Map<WebSocket, { items: string[]; bytes: number }>();
  let tick = 0;
  const started = performance.now();
  const metrics = { ticks: 0, maxMs: 0, work: [] as number[], backlogs: 0 };
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    if (req.url.startsWith("/quickscope/game") && !auth.get(req.headers.cookie))
      return reply.code(401).send({ error: "Authentication required" });
  });
  app.get("/quickscope", async (_, r) => r.redirect("/quickscope/"));
  app.get("/quickscope/", async (_, r) => r.type("text/html").send(gate));
  app.get("/quickscope/api/session", async (req) => ({
    authenticated: !!auth.get(req.headers.cookie),
    available: 18 - room.players.size,
  }));
  app.post("/quickscope/api/session", async (req, r) => {
    if (req.headers.origin !== origin)
      return r.code(403).send({ error: "Origin rejected" });
    if (!auth.allow(req.ip)) return r.code(429).send({ error: "Rate limited" });
    const password = (req.body as { password?: unknown })?.password;
    if (
      typeof password !== "string" ||
      password.length > 256 ||
      !(await auth.verify(password))
    )
      return r.code(401).send({ error: "Incorrect password" });
    if (auth.sessions.size >= 2000)
      return r.code(503).send({ error: "Session capacity" });
    const old = auth.get(req.headers.cookie);
    if (old?.player) sockets.get(old.player)?.terminate();
    auth.sessions.delete(auth.token(req.headers.cookie));
    return r
      .header("Set-Cookie", auth.cookie(auth.create()))
      .send({ ok: true });
  });
  app.delete("/quickscope/api/session", async (req, r) => {
    if (req.headers.origin !== origin) return r.code(403).send();
    const s = auth.get(req.headers.cookie);
    if (s?.player) sockets.get(s.player)?.terminate();
    auth.sessions.delete(auth.token(req.headers.cookie));
    return r.header("Set-Cookie", auth.cookie("", 0)).send({ ok: true });
  });
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async () => ({ ready: true, players: room.players.size }));
  await app.register(staticPlugin, {
    root: staticRoot,
    prefix: "/quickscope/game/",
    index: "index.html",
    cacheControl: false,
    dotfiles: "deny",
  });
  function flush(ws: WebSocket) {
    const queue = outgoing.get(ws);
    if (!queue || ws.readyState !== WebSocket.OPEN) return;
    while (queue.items.length && ws.bufferedAmount < 64 * 1024) {
      const item = queue.items.shift()!;
      queue.bytes -= Buffer.byteLength(item);
      ws.send(item);
    }
  }
  function send(ws: WebSocket, data: string | ArrayBuffer, reliable = false) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (reliable) {
      let queue = outgoing.get(ws);
      if (!queue) {
        queue = { items: [], bytes: 0 };
        outgoing.set(ws, queue);
      }
      const item = String(data);
      queue.bytes += Buffer.byteLength(item);
      if (queue.bytes > 2 * 1024 * 1024) {
        ws.close(1013, "Connection stalled");
        return;
      }
      queue.items.push(item);
      flush(ws);
      return;
    }
    if (ws.bufferedAmount > 64 * 1024 || outgoing.get(ws)?.items.length) return;
    ws.send(data);
  }
  function roster() {
    const names = Object.fromEntries(
      [...room.players.values()].map((p) => [p.id, p.name]),
    );
    for (const ws of sockets.values())
      send(ws, JSON.stringify({ type: "roster", names }), true);
  }
  room.emit = (e) => {
    const data = JSON.stringify(e);
    for (const ws of sockets.values()) send(ws, data, true);
  };
  app.server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", origin);
    const s = auth.get(req.headers.cookie);
    let code = 0,
      message = "";
    if (url.pathname !== "/quickscope/ws") {
      code = 404;
      message = "Not found";
    } else if (req.headers.origin !== origin) {
      code = 403;
      message = "Origin rejected";
    } else if (!s) {
      code = 401;
      message = "Authentication required";
    } else if (s.player) {
      code = 409;
      message = "Session already connected";
    } else if (room.players.size >= 18) {
      code = 503;
      message = "Lobby full";
    }
    if (code) {
      socket.end(
        `HTTP/1.1 ${code} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
      return;
    }
    const p = room.add(
      (url.searchParams.get("name") || "Rookie")
        .replace(/[\x00-\x1f<>]/g, "")
        .slice(0, 20),
    )!;
    s!.player = p.id;
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.set(p.id, ws);
      let rate = 0,
        window = Date.now(),
        alive = true,
        stalled = 0;
      send(
        ws,
        JSON.stringify({
          type: "welcome",
          id: p.id,
          names: Object.fromEntries(
            [...room.players.values()].map((p) => [p.id, p.name]),
          ),
        }),
        true,
      );
      send(ws, encodeSnapshot(room.snapshot()));
      roster();
      const heartbeat = setInterval(() => {
        if (
          !alive ||
          Date.now() >= s!.expires ||
          !auth.sessions.has(auth.token(req.headers.cookie)) ||
          stalled >= 3
        ) {
          ws.terminate();
          return;
        }
        if (ws.bufferedAmount > 256 * 1024) stalled++;
        else stalled = 0;
        alive = false;
        ws.ping();
      }, 5000);
      ws.on("pong", () => (alive = true));
      ws.on("error", () => ws.terminate());
      ws.on("message", (data, binary) => {
        const now = Date.now();
        if (
          now >= s!.expires ||
          !auth.sessions.has(auth.token(req.headers.cookie))
        ) {
          ws.terminate();
          return;
        }
        if (now - window >= 1000) {
          window = now;
          rate = 0;
        }
        if (++rate > 90 || !binary) {
          ws.close(1008, "Invalid input rate or type");
          return;
        }
        const b = Buffer.isBuffer(data)
          ? data
          : Buffer.from(data as ArrayBuffer);
        const i = decodeInput(
          b.buffer.slice(
            b.byteOffset,
            b.byteOffset + b.byteLength,
          ) as ArrayBuffer,
        );
        if (!i) {
          ws.close(1008, "Malformed input");
          return;
        }
        room.input(p.id, i);
      });
      ws.on("close", () => {
        clearInterval(heartbeat);
        room.remove(p.id);
        sockets.delete(p.id);
        outgoing.delete(ws);
        s!.player = undefined;
        roster();
      });
    });
  });
  const interval = setInterval(() => {
    for (const ws of sockets.values()) flush(ws);
    const elapsed = performance.now() - started;
    let steps = 0;
    while ((tick * 1000) / 60 <= elapsed && steps < 5) {
      const t = performance.now();
      room.tick((tick++ * 1000) / 60);
      metrics.work.push(performance.now() - t);
      if (metrics.work.length > 3600) metrics.work.shift();
      metrics.ticks++;
      steps++;
      if (tick % 3 === 0) {
        const data = encodeSnapshot(room.snapshot());
        for (const ws of sockets.values()) send(ws, data);
      }
    }
    if (steps === 5 && (tick * 1000) / 60 < elapsed) metrics.backlogs++;
  }, 4);
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [token, s] of auth.sessions)
      if (s.expires <= now) {
        if (s.player) sockets.get(s.player)?.terminate();
        auth.sessions.delete(token);
      }
    for (const [ip, a] of auth.attempts)
      if (a.until <= now) auth.attempts.delete(ip);
  }, 60000);
  app.addHook("onClose", async () => {
    clearInterval(interval);
    clearInterval(cleanup);
    for (const ws of sockets.values()) ws.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    room.physics.free();
  });
  return { app, auth, room, metrics };
}
