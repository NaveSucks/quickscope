import { test, before } from "node:test";
import assert from "node:assert/strict";
import { initializePhysics } from "../shared/physics.ts";
import { Room, makePlayer } from "../server/room.ts";
import { updateWeapon } from "../shared/weapons.ts";
import { B, type Input } from "../shared/types.ts";
import {
  encodeInput,
  decodeInput,
  encodeSnapshot,
  decodeSnapshot,
} from "../shared/protocol.ts";
import { wallDistance } from "../shared/map.ts";
before(initializePhysics);
const input = (changes: Partial<Input> = {}): Input => ({
  seq: 1,
  time: 1000,
  yaw: 0,
  pitch: 0,
  buttons: B.fire,
  weapon: 0,
  ...changes,
});
test("bolt, reload, ADS and swaps cannot bypass cadence", () => {
  const p = makePlayer(1, "A", 0);
  assert.equal(updateWeapon(p, input(), 1000, 250), true);
  assert.equal(p.guns[0].ammo, 6);
  assert.equal(p.protectedUntil, 0);
  assert.equal(updateWeapon(p, input(), 1100, 16), false);
  updateWeapon(p, input({ weapon: 1 }), 1200, 16);
  updateWeapon(p, input(), 1550, 16);
  assert.equal(updateWeapon(p, input(), 1900, 16), false);
  assert.equal(updateWeapon(p, input({ buttons: B.reload }), 2000, 16), false);
  assert.equal(p.guns[0].reloadEnd, 4500);
  assert.equal(updateWeapon(p, input(), 4499, 16), false);
  updateWeapon(p, input({ buttons: B.ads }), 4500, 250);
  assert.equal(p.ads, 1);
  assert.equal(p.guns[0].ammo, 7);
});
test("pistol magazine and minimum interval", () => {
  const p = makePlayer(1, "A", 0);
  p.weapon = 1;
  for (let n = 0; n < 12; n++)
    assert.equal(
      updateWeapon(p, input({ weapon: 1 }), 1000 + n * 250, 16),
      true,
    );
  assert.equal(updateWeapon(p, input({ weapon: 1 }), 5000, 16), false);
});
test("binary protocol roundtrip rejects malformed and NaN", () => {
  const i = input();
  assert.deepEqual(decodeInput(encodeInput(i)), i);
  assert.equal(decodeInput(new ArrayBuffer(2)), null);
  assert.equal(decodeInput(encodeInput(input({ yaw: NaN }))), null);
  const r = new Room();
  r.add("One");
  const s = decodeSnapshot(encodeSnapshot(r.snapshot()));
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].health, 100);
  r.physics.free();
});
test("round flow, first winner frozen, replay survives disconnect", () => {
  const r = new Room(),
    a = r.add("One")!,
    b = r.add("Two")!;
  r.tick(0);
  assert.equal(r.phase, "countdown");
  r.tick(5001);
  assert.equal(r.phase, "active");
  a.kills = 14;
  r.now = 6000;
  r.die(b, a);
  assert.equal(r.phase, "replay");
  assert.equal(a.kills, 15);
  r.die(a, b);
  assert.equal(b.kills, 0);
  r.remove(a.id);
  r.tick(6501);
  assert.equal(r.phase, "replay");
  r.tick(15501);
  assert.equal(r.phase, "results");
  r.tick(20502);
  assert.equal(r.phase, "waiting");
  r.physics.free();
});
test("capacity, duplicate inputs and disconnect release slot", () => {
  const r = new Room();
  for (let n = 0; n < 18; n++) assert.ok(r.add("Player"));
  assert.equal(r.add("19"), null);
  r.now = 1000;
  assert.equal(r.input(1, input()), true);
  assert.equal(r.input(1, input()), false);
  assert.equal(r.input(1, input({ seq: 2, time: 2000 })), false);
  r.remove(1);
  assert.ok(r.add("Replacement"));
  r.physics.free();
});
test("authoritative upper torso hit, protection and wall block", () => {
  const r = new Room(),
    a = r.add("One")!,
    b = r.add("Two")!;
  r.phase = "active";
  r.now = 1000;
  a.p = { x: 17, y: 1, z: 5 };
  b.p = { x: 17, y: 1, z: -4 };
  a.yaw = 0;
  a.grounded = true;
  a.ads = 1;
  a.pitch = -0.045;
  b.protectedUntil = 2000;
  r.shoot(a, input());
  assert.equal(b.health, 100);
  b.protectedUntil = 0;
  r.shoot(a, input());
  assert.equal(b.health, 0);
  assert.equal(a.kills, 1);
  assert.ok(wallDistance({ x: 0, y: 2, z: 52 }, { x: 0, y: 0, z: 1 }) < 4);
  r.physics.free();
});
test("fall death does not deduct kills and health regenerates", () => {
  const r = new Room(),
    p = r.add("Solo")!;
  p.kills = 3;
  p.p.y = -20;
  r.tick(1000);
  assert.equal(p.health, 0);
  assert.equal(p.kills, 3);
  r.tick(3001);
  assert.equal(p.health, 100);
  p.health = 70;
  p.lastDamage = 3001;
  r.tick(8002);
  assert.ok(p.health > 70);
  r.physics.free();
});
test("lag compensation clamps to 200ms and map blocks a historical target", () => {
  const r = new Room(),
    a = r.add("A")!,
    b = r.add("B")!;
  r.phase = "active";
  a.p = { x: 17, y: 1, z: 5 };
  b.p = { x: 17, y: 1, z: -4 };
  a.yaw = 0;
  a.grounded = true;
  a.ads = 1;
  a.pitch = -0.045;
  b.protectedUntil = 0;
  r.now = 500;
  r.history.push(r.snapshot());
  b.p.x = 18;
  r.now = 800;
  r.history.push(r.snapshot());
  r.now = 1000;
  r.shoot(a, input({ time: 500 }));
  assert.equal(b.health, 100);
  r.shoot(a, input({ time: 850 }));
  assert.equal(b.health, 100);
  r.physics.free();
});
test("replay extracts bounded pre-impact frames and accepted target pose", () => {
  const r = new Room(),
    a = r.add("A")!,
    b = r.add("B")!;
  r.phase = "active";
  for (let t = 0; t < 8000; t += 50) {
    r.now = t;
    r.history.push(r.snapshot());
  }
  r.impact = 7500;
  r.winner = a.id;
  const output: any[] = [];
  r.emit = (e) => output.push(e);
  r.sendReplay();
  assert.ok(output.length > 0);
  assert.ok(output.every((e) => e.frames.length <= 4));
  const frames = output.flatMap((e) => e.frames);
  assert.ok(frames.every((f) => f.time >= 4500 && f.time <= 8000));
  r.physics.free();
});
test("shared physics settles on roof and movement respects walls", () => {
  const r = new Room(),
    p = r.add("Mover")!;
  p.p = { x: 20, y: 2, z: 45 };
  for (let n = 0; n < 120; n++) r.physics.move(p, input({ buttons: 0 }));
  assert.ok(p.grounded);
  assert.ok(p.p.y > 0.8 && p.p.y < 1);
  for (let n = 0; n < 200; n++) r.physics.move(p, input({ buttons: B.right }));
  assert.ok(p.p.x < 27);
  r.physics.free();
});
test("crouching preserves foot position and restores standing height", () => {
  const r = new Room(),
    p = r.add("Croucher")!;
  p.p = { x: 17, y: 1, z: 5 };
  for (let n = 0; n < 30; n++) r.physics.move(p, input({ buttons: 0 }));
  const feet = p.p.y - 0.85;
  r.physics.move(p, input({ buttons: B.crouch }));
  assert.equal(p.crouch, true);
  assert.ok(Math.abs(p.p.y - 0.55 - feet) < 0.05);
  r.physics.move(p, input({ buttons: 0 }));
  assert.equal(p.crouch, false);
  assert.ok(Math.abs(p.p.y - 0.85 - feet) < 0.05);
  r.physics.free();
});
test("hit zones apply Intervention and pistol damage through authoritative rays", () => {
  for (const [weapon, offset, health] of [
    [0, 0.62, 0],
    [0, 0.18, 0],
    [0, -0.2, 30],
    [0, -0.58, 50],
    [1, 0.62, 32],
    [1, 0.18, 66],
  ] as const) {
    const r = new Room(),
      a = r.add("A")!,
      b = r.add("B")!;
    r.phase = "active";
    r.now = 1000;
    a.p = { x: 17, y: 0.88, z: 5 };
    b.p = { x: 17, y: 0.88, z: -4 };
    a.yaw = 0;
    a.pitch = Math.atan2(offset - 0.6, 9);
    a.grounded = true;
    a.ads = 1;
    a.weapon = weapon;
    b.protectedUntil = 0;
    r.shoot(a, input());
    assert.equal(b.health, health, `weapon ${weapon} offset ${offset}`);
    r.physics.free();
  }
});
