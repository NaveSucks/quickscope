import type { Input, Snapshot, Phase, PlayerState } from "./types.ts";
export const VERSION = 1,
  INPUT_SIZE = 28,
  PLAYER_SIZE = 104;
const phases: Phase[] = ["waiting", "countdown", "active", "replay", "results"];
export function encodeInput(i: Input) {
  const a = new ArrayBuffer(INPUT_SIZE),
    v = new DataView(a);
  v.setUint8(0, VERSION);
  v.setUint8(1, 1);
  v.setUint32(4, i.seq, true);
  v.setFloat64(8, i.time, true);
  v.setFloat32(16, i.yaw, true);
  v.setFloat32(20, i.pitch, true);
  v.setUint16(24, i.buttons, true);
  v.setUint8(26, i.weapon);
  return a;
}
export function decodeInput(a: ArrayBuffer): Input | null {
  if (a.byteLength !== INPUT_SIZE) return null;
  const v = new DataView(a);
  if (v.getUint8(0) !== VERSION || v.getUint8(1) !== 1) return null;
  const i = {
    seq: v.getUint32(4, true),
    time: v.getFloat64(8, true),
    yaw: v.getFloat32(16, true),
    pitch: v.getFloat32(20, true),
    buttons: v.getUint16(24, true),
    weapon: v.getUint8(26),
  };
  if (
    !Number.isFinite(i.time) ||
    !Number.isFinite(i.yaw) ||
    Math.abs(i.yaw) > Math.PI * 2 + 0.01 ||
    !Number.isFinite(i.pitch) ||
    Math.abs(i.pitch) > 1.56 ||
    i.buttons > 1023 ||
    i.weapon > 1
  )
    return null;
  return i;
}
export function encodeSnapshot(s: Snapshot) {
  const a = new ArrayBuffer(24 + s.players.length * PLAYER_SIZE),
    v = new DataView(a);
  v.setUint8(0, VERSION);
  v.setUint8(1, 2);
  v.setUint8(2, phases.indexOf(s.phase));
  v.setUint8(3, s.players.length);
  v.setFloat64(4, s.time, true);
  v.setFloat64(12, s.until, true);
  for (let j = 0; j < s.players.length; j++) {
    const p = s.players[j],
      o = 24 + j * PLAYER_SIZE;
    v.setUint16(o, p.id, true);
    v.setUint32(o + 2, p.ack, true);
    const nums = [
      p.p.x,
      p.p.y,
      p.p.z,
      p.vy,
      p.yaw,
      p.pitch,
      p.ads,
      p.health,
      p.kills,
      p.deaths,
      p.protectedUntil - s.time,
      p.respawnAt - s.time,
      p.switchEnd - s.time,
      p.guns[0].ready - s.time,
      p.guns[0].reloadEnd ? p.guns[0].reloadEnd - s.time : -1,
      p.guns[1].ready - s.time,
      p.guns[1].reloadEnd ? p.guns[1].reloadEnd - s.time : -1,
      p.lastDamage - s.time,
    ];
    nums.forEach((n, k) => v.setFloat32(o + 8 + k * 4, n, true));
    v.setUint8(o + 80, p.weapon);
    v.setUint8(o + 81, p.guns[0].ammo);
    v.setUint8(o + 82, p.guns[1].ammo);
    v.setUint8(o + 83, Number(p.grounded) | (Number(p.crouch) << 1));
  }
  return a;
}
export function decodeSnapshot(a: ArrayBuffer): Snapshot {
  const v = new DataView(a);
  if (
    a.byteLength < 24 ||
    v.getUint8(0) !== VERSION ||
    v.getUint8(1) !== 2 ||
    a.byteLength !== 24 + v.getUint8(3) * PLAYER_SIZE
  )
    throw Error("Bad snapshot");
  const time = v.getFloat64(4, true),
    s: Snapshot = {
      time,
      until: v.getFloat64(12, true),
      phase: phases[v.getUint8(2)],
      players: [],
    };
  for (let j = 0; j < v.getUint8(3); j++) {
    const o = 24 + j * PLAYER_SIZE,
      n = (k: number) => v.getFloat32(o + 8 + k * 4, true),
      flags = v.getUint8(o + 83);
    s.players.push({
      id: v.getUint16(o, true),
      ack: v.getUint32(o + 2, true),
      name: "",
      p: { x: n(0), y: n(1), z: n(2) },
      vy: n(3),
      yaw: n(4),
      pitch: n(5),
      ads: n(6),
      health: n(7),
      kills: n(8),
      deaths: n(9),
      protectedUntil: time + n(10),
      respawnAt: time + n(11),
      switchEnd: time + n(12),
      guns: [
        {
          ammo: v.getUint8(o + 81),
          ready: time + n(13),
          reloadEnd: n(14) < 0 ? 0 : time + n(14),
        },
        {
          ammo: v.getUint8(o + 82),
          ready: time + n(15),
          reloadEnd: n(16) < 0 ? 0 : time + n(16),
        },
      ],
      lastDamage: time + n(17),
      weapon: v.getUint8(o + 80),
      grounded: !!(flags & 1),
      crouch: !!(flags & 2),
    });
  }
  return s;
}
