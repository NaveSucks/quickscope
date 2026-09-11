import { test, before } from "node:test";
import assert from "node:assert/strict";
import { initializePhysics, Physics } from "../shared/physics.ts";
import { makePlayer } from "../server/room.ts";
import { map } from "../shared/map.ts";
import { B, type PlayerState } from "../shared/types.ts";
before(initializePhysics);
function walk(
  world: Physics,
  p: PlayerState,
  yaw: number,
  buttons: number,
  frames: number,
) {
  for (let n = 0; n < frames; n++)
    world.move(p, {
      seq: n + 1,
      time: (n * 1000) / 60,
      yaw,
      pitch: 0,
      buttons,
      weapon: 0,
    });
}
test("every authored spawn settles safely on traversable geometry", () => {
  const world = new Physics();
  for (let n = 0; n < map.spawns.length; n++) {
    const p = makePlayer(n + 1, "route", 0);
    p.p = { ...map.spawns[n] };
    walk(world, p, 0, 0, 120);
    assert.ok(p.grounded, `spawn ${n} not grounded`);
    assert.ok(p.p.y > -4, `spawn ${n} fell`);
    assert.ok(Math.abs(p.p.x - map.spawns[n].x) < 0.1);
  }
  world.free();
});
test("north lower stair connects pit to office without ceiling blockage", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: -9, y: -2.72, z: -24.5 };
  walk(world, p, 0, B.forward, 145);
  assert.ok(p.p.z < -34, JSON.stringify(p.p));
  assert.ok(p.p.y > 0.8, JSON.stringify(p.p));
  world.free();
});
test("south lower stair connects pit to office", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: -11.2, y: -2.72, z: 27 };
  walk(world, p, Math.PI, B.forward, 125);
  assert.ok(p.p.z > 36, JSON.stringify(p.p));
  assert.ok(p.p.y > 0.8, JSON.stringify(p.p));
  world.free();
});
test("helipad stairs reach the raised deck", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: 7, y: 0.88, z: 12 };
  walk(world, p, 0, B.forward, 90);
  assert.ok(p.p.y > 3.2, JSON.stringify(p.p));
  world.free();
});
test("lower east ladder exits through its open shaft", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: 18.96, y: -2.72, z: -0.96 };
  walk(world, p, -Math.PI / 2, B.forward, 85);
  assert.ok(p.p.y > 0.8, JSON.stringify(p.p));
  assert.ok(p.p.x > 20.5, JSON.stringify(p.p));
  world.free();
});
test("scaffold ladder reaches the second suspended platform", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: 26, y: 1.98, z: 25.5 };
  walk(world, p, Math.PI, B.forward, 90);
  assert.ok(p.p.y > 3.9, JSON.stringify(p.p));
  assert.ok(p.p.z > 27, JSON.stringify(p.p));
  world.free();
});
test("executive roof mantle clears the parapet", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: 28.15, y: 4.64, z: 53 };
  walk(world, p, Math.PI / 2, B.jump | B.forward, 60);
  walk(world, p, Math.PI / 2, 0, 90);
  assert.ok(p.p.y > 5.6, JSON.stringify(p.p));
  assert.ok(p.p.x < 27, JSON.stringify(p.p));
  world.free();
});
test("crane access ladder clears foundation and reaches boom", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: -26.1, y: 0.88, z: -8 };
  walk(world, p, Math.PI / 2, B.forward, 85);
  assert.ok(p.p.y > 4.8, JSON.stringify(p.p));
  assert.ok(p.p.x < -26.5, JSON.stringify(p.p));
  world.free();
});
test("west office roof mantle reaches mail roof", () => {
  const world = new Physics(),
    p = makePlayer(1, "route", 0);
  p.p = { x: -30, y: 4.97, z: -43 };
  walk(world, p, -Math.PI / 2, B.jump | B.forward, 60);
  walk(world, p, 0, 0, 90);
  assert.ok(p.p.y > 5.6, JSON.stringify(p.p));
  assert.ok(p.p.x > -28.5, JSON.stringify(p.p));
  world.free();
});
