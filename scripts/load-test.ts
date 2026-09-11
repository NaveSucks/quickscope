import { scryptSync, randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import { initializePhysics } from "../shared/physics.ts";
import { createApp } from "../server/app.ts";
import { encodeInput, decodeSnapshot } from "../shared/protocol.ts";
import { writeFileSync } from "node:fs";
await initializePhysics();
const salt = randomBytes(16).toString("hex"),
  hash = salt + ":" + scryptSync(randomBytes(16), salt, 32).toString("hex"),
  origin = "http://127.0.0.1:8192";
const { app, auth, room, metrics } = await createApp(hash, origin);
await app.listen({ host: "127.0.0.1", port: 8192 });
const sockets: WebSocket[] = [],
  timers: ReturnType<typeof setInterval>[] = [],
  start = Date.now(),
  duration = Number(process.env.LOAD_SECONDS || 1800) * 1000,
  samples: unknown[] = [];
for (let n = 0; n < 18; n++) {
  const token = auth.create(),
    ws = new WebSocket("ws://127.0.0.1:8192/quickscope/ws?name=load" + n, {
      headers: { Origin: origin, Cookie: "qs=" + token },
    });
  sockets.push(ws);
  let time = 0,
    received = performance.now(),
    seq = 0;
  ws.on("message", (data, binary) => {
    if (binary) {
      const b = data as Buffer;
      const s = decodeSnapshot(
        b.buffer.slice(
          b.byteOffset,
          b.byteOffset + b.byteLength,
        ) as ArrayBuffer,
      );
      time = s.time;
      received = performance.now();
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  timers.push(
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const elapsed = (Date.now() - start) / 1000;
        ws.send(
          encodeInput({
            seq: ++seq,
            time: time + performance.now() - received,
            yaw: Math.sin(elapsed * 0.3 + n) * Math.PI,
            pitch: 0,
            buttons:
              1 |
              128 |
              256 |
              (seq % 100 > 90 ? 512 : 0) |
              (seq % 120 < 5 ? 16 : 0),
            weapon: Math.floor(elapsed / 9) % 2,
          }),
        );
      }
    }, 1000 / 60),
  );
}
const sampling = setInterval(() => {
  const work = [...metrics.work].sort((a, b) => a - b),
    sample = {
      seconds: Math.round((Date.now() - start) / 1000),
      players: room.players.size,
      p95Ms: work[Math.floor(work.length * 0.95)],
      rssMiB: process.memoryUsage().rss / 1048576,
      backlogs: metrics.backlogs,
    };
  samples.push(sample);
  console.log(JSON.stringify(sample));
}, 30000);
setTimeout(async () => {
  clearInterval(sampling);
  timers.forEach(clearInterval);
  sockets.forEach((ws) => ws.close());
  await new Promise((r) => setTimeout(r, 100));
  await app.close();
  writeFileSync(
    "test-results/load.json",
    JSON.stringify({ duration, samples }, null, 2),
  );
}, duration);
