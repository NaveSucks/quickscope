import { chromium, type Page } from "@playwright/test";
import { scryptSync, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { initializePhysics } from "../shared/physics.ts";
import { createApp } from "../server/app.ts";
await initializePhysics();
const password = randomBytes(18).toString("hex"),
  salt = randomBytes(16).toString("hex");
const { app, auth, room } = await createApp(
  salt + ":" + scryptSync(password, salt, 32).toString("hex"),
  "http://localhost:8191",
);
await app.listen({ host: "127.0.0.1", port: 8191 });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-webgl", "--no-sandbox"],
});
let rtt = 50;
// Deterministic application-message impairment; reliable events stay ordered.
async function impair(page: Page) {
  await page.routeWebSocket("**/quickscope/ws*", (ws) => {
    const server = ws.connectToServer();
    let count = 0,
      inOrder = 0,
      outOrder = 0;
    ws.onMessage((message) => {
      count++;
      if (count % 47 === 0) return;
      const due = Math.max(
        outOrder,
        Date.now() + rtt / 2 + ((count % 7) - 3) * 2,
      );
      outOrder = due;
      setTimeout(
        () => {
          try {
            server.send(message);
          } catch {}
        },
        Math.max(0, due - Date.now()),
      );
    });
    server.onMessage((message) => {
      count++;
      if (typeof message !== "string" && count % 53 === 0) return;
      const due = Math.max(
        inOrder,
        Date.now() + rtt / 2 + ((count % 5) - 2) * 2,
      );
      inOrder = due;
      setTimeout(
        () => {
          try {
            ws.send(message);
          } catch {}
        },
        Math.max(0, due - Date.now()),
      );
    });
  });
}
try {
  await mkdir("test-results", { recursive: true });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    }),
    page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("http://localhost:8191/quickscope/");
  await page.waitForTimeout(300);
  assert.ok(requests.every((u) => !u.includes("/game/")));
  for (const path of [
    "assets/index.js",
    "nested/rapier.wasm",
    "audio/shot.wav",
  ])
    assert.equal(
      (
        await context.request.get(
          "http://localhost:8191/quickscope/game/" + path,
        )
      ).status(),
      401,
    );
  assert.ok(
    await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://localhost:8191/quickscope/ws");
          ws.onerror = () => resolve(true);
          ws.onopen = () => resolve(false);
        }),
    ),
  );
  await page.screenshot({ path: "test-results/gate.png" });
  await page.locator("#password").fill(password);
  await page.locator("#gate button").click();
  await page.locator("#name").waitFor({ state: "visible" });
  await page.locator("#name").fill("Browser A");
  await impair(page);
  await page.locator("#nickname button").click();
  await page.waitForFunction(
    () => !(document.getElementById("play") as HTMLButtonElement)?.disabled,
  );
  assert.equal(room.players.size, 1);
  const ctx2 = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await ctx2.addCookies([
    {
      name: "qs",
      value: auth.create(),
      domain: "localhost",
      path: "/quickscope",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page2 = await ctx2.newPage();
  page2.on("pageerror", (e) => errors.push(e.message));
  await impair(page2);
  await page2.goto("http://localhost:8191/quickscope/game/");
  await page2.waitForFunction(
    () => !(document.getElementById("play") as HTMLButtonElement)?.disabled,
  );
  assert.equal(room.players.size, 2);
  await page.waitForTimeout(5500);
  assert.equal(room.phase, "active");
  await page.bringToFront();
  await page.locator("#play").click();
  const reports: unknown[] = [];
  for (const latency of [50, 100, 150]) {
    rtt = latency;
    await page.evaluate(() => {
      (window as any).quickscopeMetrics.corrections = [];
    });
    const before = { ...room.players.values().next().value!.p };
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyA");
    await page.waitForTimeout(500);
    const report = await page.evaluate(() => {
      const m = (window as any).quickscopeMetrics,
        c = [...m.corrections].sort((a: number, b: number) => a - b);
      return {
        p95Correction: c[Math.floor(c.length * 0.95)] || 0,
        maxCorrection: Math.max(0, ...c),
        position: m.position,
        rtt: m.rtt,
      };
    });
    assert.ok(report.maxCorrection < 2, JSON.stringify(report));
    reports.push({ configuredRtt: latency, ...report, before });
  }
  await page.screenshot({ path: "test-results/gameplay.png" });
  // Arrange a deterministic combat fixture without giving clients authority.
  const [a, b] = [...room.players.values()];
  room.phase = "results";
  room.until = Infinity;
  a.health = b.health = 0;
  await page.waitForTimeout(350);
  Object.assign(a, {
    p: { x: 17, y: 0.88, z: 5 },
    yaw: 0,
    pitch: -0.04,
    health: 100,
    kills: 14,
    protectedUntil: 0,
    respawnAt: 0,
  });
  Object.assign(b, {
    p: { x: 17, y: 0.88, z: -4 },
    yaw: Math.PI,
    pitch: 0,
    health: 100,
    protectedUntil: 0,
    respawnAt: 0,
  });
  await page.waitForTimeout(350);
  room.phase = "active";
  room.until = 0;
  room.history = [];
  await page.waitForTimeout(500);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(650);
  assert.ok(a.ads > 0.95);
  await page.screenshot({ path: "test-results/scoped.png" });
  await page.mouse.down({ button: "left" });
  await page.waitForTimeout(100);
  await page.mouse.up({ button: "left" });
  await page.waitForTimeout(500);
  assert.equal(a.kills, 15);
  assert.equal(room.phase, "replay");
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(() =>
    document.getElementById("banner")!.textContent!.includes("FINAL KILLCAM"),
  );
  await page.screenshot({ path: "test-results/killcam.png" });
  await page.waitForTimeout(15500);
  assert.ok(["countdown", "active"].includes(room.phase));
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/network.json",
    JSON.stringify(reports, null, 2),
  );
  await ctx2.close();
  await context.close();
  console.log(
    "Browser auth, impaired two-client prediction, actual winning shot and replay passed.",
  );
} finally {
  await browser.close();
  await app.close();
}
