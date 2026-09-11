import "./style.css";
import * as T from "three";
import { scene, avatar, poseAvatar, gun } from "./scene.ts";
import { Physics, initializePhysics } from "../shared/physics.ts";
import {
  B,
  type Input,
  type PlayerState,
  type Snapshot,
  type GameEvent,
} from "../shared/types.ts";
import { encodeInput, decodeSnapshot } from "../shared/protocol.ts";
import { updateWeapon, weapons } from "../shared/weapons.ts";
import { Sound } from "./audio.ts";
const el = (id: string) => document.getElementById(id)!;
const canvas = el("view") as HTMLCanvasElement,
  menu = el("menu"),
  play = el("play") as HTMLButtonElement;
const defaults = {
  sensitivity: 1,
  adsSensitivity: 0.6,
  fov: 85,
  volume: 0.5,
  quality: 0.8,
};
let settings = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem("qs-settings") || "{}");
  for (const k of Object.keys(defaults) as (keyof typeof defaults)[])
    if (Number.isFinite(saved[k])) settings[k] = saved[k];
} catch {}
for (const key of Object.keys(settings) as (keyof typeof settings)[]) {
  const input = el(key) as HTMLInputElement;
  input.value = String(settings[key]);
  settings[key] = Number(input.value);
  input.oninput = () => {
    settings[key] = Number(input.value);
    localStorage.setItem("qs-settings", JSON.stringify(settings));
    resize();
  };
}
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
const camera = new T.PerspectiveCamera(
  settings.fov,
  innerWidth / innerHeight,
  0.04,
  300,
);
camera.rotation.order = "YXZ";
scene.add(camera);
const guns = [gun(), gun(true)];
for (const g of guns) {
  camera.add(g);
  g.position.set(0.24, -0.25, -0.45);
}
function resize() {
  renderer.setSize(
    innerWidth * settings.quality,
    innerHeight * settings.quality,
    false,
  );
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
const sound = new Sound(),
  keys = new Set<string>(),
  remote = new Map<number, T.Group>();
let local: PlayerState | undefined,
  id = 0,
  names: Record<number, string> = {},
  seq = 0,
  yaw = 0,
  pitch = 0,
  weapon = 0,
  buttons = 0,
  serverOffset = 0,
  latest: Snapshot | undefined,
  pending: Input[] = [],
  snapshots: Snapshot[] = [],
  lastShot = -10000,
  lastStep = 0,
  hitUntil = 0,
  connected = false,
  accumulator = 0,
  previous = performance.now();
let physics: Physics;
let replay:
  | {
      frames: Snapshot[];
      events: GameEvent[];
      winner: number;
      impact: number;
      start: number;
      received: Set<number>;
      total: number;
    }
  | undefined;
let ws: WebSocket;
const diagnostics = {
  corrections: [] as number[],
  rtt: 0,
  position: { x: 0, y: 0, z: 0 },
};
Object.defineProperty(window, "quickscopeMetrics", {
  value: diagnostics,
  writable: false,
});
const sentAt = new Map<number, number>();
function locked() {
  return document.pointerLockElement === canvas;
}
function clearInput() {
  keys.clear();
  buttons = 0;
}
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});
play.onclick = () => {
  sound.start();
  canvas.requestPointerLock();
};
document.addEventListener("pointerlockchange", () => {
  menu.style.display = locked() ? "none" : "grid";
  clearInput();
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousemove", (e) => {
  if (!locked() || replay) return;
  const factor =
    0.002 * settings.sensitivity * (local?.ads ? settings.adsSensitivity : 1);
  yaw = (yaw - e.movementX * factor) % (Math.PI * 2);
  pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY * factor));
});
window.addEventListener("mousedown", (e) => {
  if (locked()) {
    if (e.button === 0) buttons |= B.fire;
    if (e.button === 2) buttons |= B.ads;
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) buttons &= ~B.fire;
  if (e.button === 2) buttons &= ~B.ads;
});
window.addEventListener("keydown", (e) => {
  if (["Tab", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "Tab") el("scoreboard").hidden = false;
  if (!locked()) return;
  keys.add(e.code);
  if (e.code === "Digit1") weapon = 0;
  if (e.code === "Digit2") weapon = 1;
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") el("scoreboard").hidden = true;
});
window.addEventListener("wheel", () => {
  if (locked()) weapon = 1 - weapon;
});
el("logout").onclick = async () => {
  await fetch("/quickscope/api/session", { method: "DELETE" });
  location.href = "/quickscope/";
};
const feed: string[] = [];
function feedLine(text: string) {
  feed.unshift(text);
  feed.length = Math.min(feed.length, 5);
  el("feed").replaceChildren(
    ...feed.map((s) => {
      const d = document.createElement("div");
      d.textContent = s;
      return d;
    }),
  );
}
function event(e: GameEvent) {
  if (e.type === "welcome") {
    id = e.id;
    names = e.names;
    connected = true;
    el("status").textContent =
      "Lobby ready. Click Deploy to capture your mouse.";
    play.disabled = false;
  }
  if (e.type === "roster") {
    names = e.names;
    for (const [pid, g] of remote)
      if (!(pid in names)) {
        scene.remove(g);
        g.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => m.dispose());
          }
        });
        remote.delete(pid);
      }
  }
  if (e.type === "shot" && !replay) {
    if (e.id !== id) {
      sound.play("shot", e.from, local?.p, yaw, e.weapon);
      if (e.weapon === 0)
        setTimeout(() => sound.play("bolt", e.from, local?.p, yaw), 350);
    }
    if (e.id === id) {
      if (performance.now() - lastShot > 300) lastShot = performance.now();
      if (e.hit) {
        hitUntil = performance.now() + 180;
        sound.play("hit");
      }
    }
    const geometry = new T.BufferGeometry().setFromPoints([
        new T.Vector3(e.from.x, e.from.y, e.from.z),
        new T.Vector3(e.to.x, e.to.y, e.to.z),
      ]),
      mat = new T.LineBasicMaterial({
        color: 0xe4d6a3,
        transparent: true,
        opacity: 0.5,
      }),
      line = new T.Line(geometry, mat);
    scene.add(line);
    setTimeout(() => {
      scene.remove(line);
      geometry.dispose();
      mat.dispose();
    }, 70);
  }
  if (e.type === "death")
    feedLine(
      `${e.killer ? names[e.killer] || "Player" : "Gravity"}  →  ${names[e.id] || "Player"}`,
    );
  if (e.type === "phase" && e.phase !== "replay") {
    replay = undefined;
  }
  if (e.type === "replay") {
    if (!replay)
      replay = {
        frames: [],
        events: [],
        winner: e.winner,
        impact: e.impact,
        start: performance.now(),
        received: new Set(),
        total: e.total,
      };
    if (!replay.received.has(e.index)) {
      replay.received.add(e.index);
      replay.frames.push(...e.frames);
      replay.events.push(...e.events);
      replay.frames.sort((a, b) => a.time - b.time);
    }
    if (replay.received.size === replay.total) replay.start = performance.now();
  }
}
function score(s: Snapshot) {
  el("scoreboard").replaceChildren(
    ...[...s.players]
      .sort((a, b) => b.kills - a.kills)
      .map((p) => {
        const row = document.createElement("div"),
          name = document.createElement("span"),
          stats = document.createElement("span");
        name.textContent = names[p.id] || p.name;
        stats.textContent = `${p.kills} K / ${p.deaths} D`;
        row.append(name, stats);
        return row;
      }),
  );
}
function sample(frames: Snapshot[], time: number) {
  let a = frames[0],
    b = a;
  for (const f of frames) {
    if (f.time <= time) a = f;
    else {
      b = f;
      break;
    }
  }
  if (!a) return undefined;
  if (b.time < a.time) b = a;
  const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time || 1)));
  const out = structuredClone(a);
  for (const p of out.players) {
    const next = b.players.find((n) => n.id === p.id);
    if (!next || (next.health !== p.health && next.health <= 0)) continue;
    if (Math.hypot(next.p.x - p.p.x, next.p.y - p.p.y, next.p.z - p.p.z) < 4) {
      for (const k of ["x", "y", "z"] as const)
        p.p[k] += (next.p[k] - p.p[k]) * t;
    }
    p.yaw +=
      Math.atan2(Math.sin(next.yaw - p.yaw), Math.cos(next.yaw - p.yaw)) * t;
    p.pitch += (next.pitch - p.pitch) * t;
    p.ads += (next.ads - p.ads) * t;
  }
  return out;
}
async function start() {
  await initializePhysics();
  physics = new Physics();
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/quickscope/ws?name=${encodeURIComponent(sessionStorage.getItem("qs-name") || "Rookie")}`,
  );
  ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => {
    if (typeof e.data === "string") {
      event(JSON.parse(e.data));
      return;
    }
    const s = decodeSnapshot(e.data),
      now = performance.now();
    serverOffset = s.time - now;
    snapshots.push(s);
    if (snapshots.length > 12) snapshots.shift();
    latest = s;
    score(s);
    const authoritative = s.players.find((p) => p.id === id);
    const previousPosition = local ? { ...local.p } : undefined;
    const previousHealth = local?.health;
    if (!authoritative) return;
    if (!local || (local.health <= 0 && authoritative.health > 0)) {
      yaw = authoritative.yaw;
      pitch = authoritative.pitch;
      pending = [];
    }
    const sent = sentAt.get(authoritative.ack);
    if (sent !== undefined) diagnostics.rtt = now - sent;
    for (const sequence of sentAt.keys())
      if (sequence <= authoritative.ack) sentAt.delete(sequence);
    pending = pending.filter((i) => i.seq > authoritative.ack);
    local = structuredClone(authoritative);
    if (s.phase !== "replay" && s.phase !== "results" && local.health > 0)
      for (const i of pending) {
        physics.move(local, i);
        updateWeapon(local, i, i.time, 1000 / 60);
      }
    if (
      previousPosition &&
      (previousHealth ?? 0) > 0 &&
      local.health > 0 &&
      s.phase === "active"
    ) {
      diagnostics.corrections.push(
        Math.hypot(
          local.p.x - previousPosition.x,
          local.p.y - previousPosition.y,
          local.p.z - previousPosition.z,
        ),
      );
      if (diagnostics.corrections.length > 600) diagnostics.corrections.shift();
    }
  };
  ws.onclose = async (e) => {
    connected = false;
    document.exitPointerLock();
    play.disabled = true;
    let message = e.reason || "Connection closed.";
    try {
      const s = await (await fetch("/quickscope/api/session")).json();
      if (!s.authenticated) {
        location.href = "/quickscope/";
        return;
      }
      if (!s.available) message = "Lobby full.";
    } catch {}
    el("status").textContent = message + " Reload to reconnect.";
  };
  ws.onerror = () => {
    el("status").textContent = "Unable to join lobby.";
  };
  requestAnimationFrame(render);
}
function render(now: number) {
  const dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  accumulator += dt;
  sound.volume = settings.volume;
  const serverNow = now + serverOffset;
  while (accumulator >= 1 / 60) {
    accumulator -= 1 / 60;
    if (local && connected) {
      let b = locked() ? buttons : 0;
      for (const [key, flag] of Object.entries({
        KeyW: B.forward,
        KeyS: B.back,
        KeyA: B.left,
        KeyD: B.right,
        Space: B.jump,
        ShiftLeft: B.sprint,
        ShiftRight: B.sprint,
        KeyC: B.crouch,
        KeyR: B.reload,
      }))
        if (keys.has(key)) b |= flag;
      const i: Input = {
        seq: ++seq,
        time: serverNow,
        yaw,
        pitch,
        buttons: b,
        weapon,
      };
      if (ws.bufferedAmount < 4096) {
        ws.send(encodeInput(i));
        sentAt.set(i.seq, now);
        if (sentAt.size > 180) sentAt.delete(sentAt.keys().next().value!);
        pending.push(i);
        if (pending.length > 120) {
          pending = [];
        }
      }
      if (
        local.health > 0 &&
        latest?.phase !== "replay" &&
        latest?.phase !== "results"
      ) {
        physics.move(local, i);
        if (updateWeapon(local, i, serverNow, 1000 / 60)) {
          lastShot = now;
          sound.play("shot", undefined, undefined, 0, local.weapon);
          if (local.weapon === 0) setTimeout(() => sound.play("bolt"), 350);
        }
        if (b & 15 && local.grounded && now - lastStep > 380) {
          sound.play("step");
          lastStep = now;
        }
      }
    }
  }
  let display = sample(snapshots, serverNow - 100),
    view = local,
    replayTime = 0;
  if (replay && replay.received.size === replay.total) {
    const elapsed = now - replay.start,
      start = Math.max(replay.impact - 3000, replay.frames[0]?.time || 0),
      normal = Math.max(0, replay.impact - 1000 - start);
    replayTime =
      start +
      (elapsed <= normal ? elapsed : normal + (elapsed - normal) * 0.25);
    display = sample(replay.frames, replayTime);
    view = display?.players.find((p) => p.id === replay!.winner);
    const hit = replay.events.find(
      (e) => e.type === "shot" && e.time === replay!.impact,
    );
    if (
      hit?.type === "shot" &&
      hit.pose &&
      Math.abs(replayTime - replay.impact) < 120
    ) {
      const target = display?.players.find((p) => p.id === hit.hit);
      if (target) Object.assign(target, hit.pose);
    }
    el("banner").textContent =
      `FINAL KILLCAM · ${names[replay.winner] || "Winner"}`;
  }
  if (display) {
    const visible = new Set<number>();
    for (const p of display.players) {
      if (p.id === view?.id) continue;
      visible.add(p.id);
      let g = remote.get(p.id);
      if (!g) {
        g = avatar();
        remote.set(p.id, g);
        scene.add(g);
      }
      poseAvatar(g, p, now);
    }
    for (const [pid, g] of remote) if (!visible.has(pid)) g.visible = false;
  }
  if (view) {
    diagnostics.position = { ...view.p };
    camera.position.set(
      view.p.x,
      view.p.y + (view.crouch ? 0.25 : 0.6),
      view.p.z,
    );
    camera.rotation.set(
      replay ? view.pitch : pitch,
      replay ? view.yaw : yaw,
      0,
      "YXZ",
    );
    const ads = view.ads;
    camera.fov =
      settings.fov +
      (view.weapon === 0 ? 25 - settings.fov : 60 - settings.fov) * ads;
    camera.updateProjectionMatrix();
    el("scope").style.display =
      ads > 0.94 && view.weapon === 0 ? "block" : "none";
    el("crosshair").style.display = ads > 0.94 ? "none" : "block";
    el("health").textContent = String(Math.ceil(view.health));
    el("ammo").textContent = `${view.guns[view.weapon].ammo} / ∞`;
    el("weapon").textContent =
      weapons[view.weapon].name +
      (view.guns[view.weapon].reloadEnd ? " · RELOADING" : "");
    const animationTime = replay ? replayTime : serverNow;
    const replayShot = replay?.events
      .filter(
        (e) =>
          e.type === "shot" && e.id === replay!.winner && e.time <= replayTime,
      )
      .at(-1);
    const shotAge = replay
      ? replayShot && "time" in replayShot
        ? replayTime - replayShot.time
        : 10000
      : now - lastShot;
    const recoil = Math.max(0, 1 - shotAge / 160);
    guns.forEach((g, j) => {
      g.visible = j === view!.weapon && !(ads > 0.94 && j === 0);
      const swap = Math.max(0, (view!.switchEnd - animationTime) / 350),
        reload = view!.guns[j].reloadEnd
          ? Math.sin(
              Math.max(
                0,
                (view!.guns[j].reloadEnd - animationTime) / weapons[j].reloadMs,
              ) * Math.PI,
            )
          : 0,
        sprint = keys.has("ShiftLeft") && !ads;
      g.position.set(
        0.24 * (1 - ads),
        -0.25 + ads * 0.08 - swap * 0.5 - reload * 0.15,
        -0.45 + recoil * 0.1,
      );
      g.rotation.set(
        recoil * 0.12 + reload * 0.65 + (sprint ? 0.35 : 0),
        sprint ? -0.4 : 0,
        swap * 0.5 + reload * 0.35,
      );
      if (j === 0 && g.children[5])
        g.children[5].position.z =
          -0.15 +
          Math.sin(Math.max(0, Math.min(1, (shotAge - 150) / 700)) * Math.PI) *
            0.13;
    });
  }
  if (latest) {
    el("phase").textContent =
      `${latest.phase.toUpperCase()} · ${Math.max(0, ...latest.players.map((p) => p.kills))} / 15`;
    if (!replay)
      el("banner").textContent =
        latest.phase === "waiting"
          ? "PRACTICE · WAITING FOR A SECOND PLAYER"
          : latest.phase === "countdown"
            ? `ROUND STARTS IN ${Math.max(0, Math.ceil((latest.until - serverNow) / 1000))}`
            : latest.phase === "replay"
              ? "FINAL SHOT"
              : latest.phase === "results"
                ? "ROUND COMPLETE"
                : local?.health === 0
                  ? "RESPAWNING…"
                  : "";
  }
  el("connection").textContent =
    `${latest?.players.length || 0} / 18 · ${Math.round(diagnostics.rtt)} MS`;
  el("hit").style.opacity = now < hitUntil ? "1" : "0";
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
start().catch((e) => {
  el("status").textContent =
    "Unable to initialize WebGL2 or the game. " + e.message;
});
