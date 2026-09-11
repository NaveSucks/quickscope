import { chromium } from "@playwright/test";
import { scryptSync, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { initializePhysics } from "../shared/physics.ts";
import { createApp } from "../server/app.ts";
import { impairmentProxy } from "./impairment.ts";
await initializePhysics();
const password = randomBytes(18).toString("hex"),
  salt = randomBytes(16).toString("hex");
const { app, auth, room, metrics } = await createApp(
  salt + ":" + scryptSync(password, salt, 32).toString("hex"),
  "http://localhost:8193",
);
await app.listen({ host: "127.0.0.1", port: 8191 });
const browser = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--disable-audio-output",
    "--no-sandbox",
  ],
});
const browserSetup = `try{localStorage.setItem('qs-settings',JSON.stringify({quality:.5,volume:0}));}catch{}const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>{const start=performance.now();function frame(t){if(t-start<60)raf(frame);else callback(t);}return raf(frame);};`;
let rtt = 50;
const closeProxy = await impairmentProxy(8191, 8193, () => rtt);

try {
  await mkdir("test-results", { recursive: true });
  const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
    }),
    page = await context.newPage(),
    errors: string[] = [];
  await context.addInitScript({ content: browserSetup });
  page.on("pageerror", (e) => errors.push(e.message));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("http://localhost:8193/quickscope/");
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
          "http://localhost:8193/quickscope/game/" + path,
        )
      ).status(),
      401,
    );
  assert.ok(
    await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://localhost:8193/quickscope/ws");
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
  await page.locator("#nickname button").click();
  await page.waitForFunction(
    () => !(document.getElementById("play") as HTMLButtonElement)?.disabled,
  );
  assert.equal(room.players.size, 1);
  const ctx2 = await browser.newContext({
    viewport: { width: 640, height: 360 },
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
  await ctx2.addInitScript({ content: browserSetup });
  const page2 = await ctx2.newPage();
  page2.on("pageerror", (e) => errors.push(e.message));
  await page2.goto("http://localhost:8193/quickscope/game/");
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
    console.log(JSON.stringify({ latency, ...report }));
    assert.ok(
      report.maxCorrection < 2 && report.p95Correction < 0.5,
      JSON.stringify(report),
    );
    reports.push({ configuredRtt: latency, ...report, before });
  }
  await page.screenshot({ path: "test-results/gameplay.png" });
  // Arrange a deterministic combat fixture without giving clients authority.
  const [a, b] = [...room.players.values()];
  room.phase = "results";
  room.until = Infinity;
  a.health = b.health = 0;
  await page.waitForFunction(
    () => document.getElementById("health")?.textContent === "0",
  );
  Object.assign(a, {
    p: { x: 17, y: 0.88, z: 5 },
    yaw: 0,
    pitch: -0.04,
    health: 100,
    kills: 14,
    life: a.life + 1,
    protectedUntil: 0,
    respawnAt: 0,
  });
  Object.assign(b, {
    p: { x: 17, y: 0.88, z: -4 },
    life: b.life + 1,
    yaw: Math.PI,
    pitch: 0,
    health: 100,
    protectedUntil: 0,
    respawnAt: 0,
  });
  await page.waitForFunction(
    () => document.getElementById("health")?.textContent === "100",
  );
  room.phase = "active";
  room.until = 0;
  room.history = [];
  await page.waitForTimeout(500);
  // Dispatch relative-mode buttons without the driver injecting absolute mouse coordinates.
  await page.evaluate(() =>
    window.dispatchEvent(new MouseEvent("mousedown", { button: 2 })),
  );
  for (let n = 0; n < 40 && a.ads < 0.95; n++) await page.waitForTimeout(50);
  console.log(
    JSON.stringify({
      ads: a.ads,
      ack: a.ack,
      input: room.lastInput.get(a.id),
      phase: room.phase,
      serverTime: room.now,
      backlogs: metrics.backlogs,
      locked: await page.evaluate(() => !!document.pointerLockElement),
      clock: await page.evaluate(() => performance.now()),
      diag: await page.evaluate(() => (window as any).quickscopeMetrics.rtt),
    }),
  );
  assert.ok(a.ads > 0.95);
  await page.screenshot({ path: "test-results/scoped.png" });
  await page.evaluate(() =>
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(500);
  await page.evaluate(() =>
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 })),
  );
  for (let n = 0; n < 40 && a.kills < 15; n++) await page.waitForTimeout(50);
  console.log(
    JSON.stringify({
      shooter: {
        p: a.p,
        health: a.health,
        ads: a.ads,
        grounded: a.grounded,
        guns: a.guns,
      },
      target: { p: b.p, health: b.health },
      recent: room.events.slice(-4),
      input: room.lastInput.get(a.id),
    }),
  );
  assert.equal(a.kills, 15);
  assert.equal(room.phase, "replay");
  await page.evaluate(() =>
    window.dispatchEvent(new MouseEvent("mouseup", { button: 2 })),
  );
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
  await closeProxy();
  await app.close();
}
