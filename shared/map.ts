import type { MapDefinition, Vec } from "./types.ts";
const boxes: MapDefinition["boxes"] = [];
function box(
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color = 0x88877c,
  material = "concrete",
) {
  boxes.push({ id, p: { x, y, z }, s: { x: w, y: h, z: d }, color, material });
}
// Original-era overhead schematic: pixel anchors are transformed into metres.
// Source and uncertainty are documented in docs/MAP.md. Images are not shipped.
// Plan origin (240,315), scale .24 m/px; vertical dimensions are playtest tuning.
const scale = 0.24;
function plan(
  id: string,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  y = 0,
  h = 1,
  color = 0x868579,
  material = "concrete",
) {
  box(
    id,
    ((x1 + x2) / 2 - 240) * scale,
    y - h / 2,
    ((z1 + z2) / 2 - 315) * scale,
    (x2 - x1) * scale,
    h,
    (z2 - z1) * scale,
    color,
    material,
  );
}
// Split main deck around the two characteristic west-side red pits.
plan("west-rim", 137, 192, 162, 431);
plan("east-main-deck", 220, 192, 307, 431);
plan("east-edge-deck", 324, 192, 333, 431);
plan("east-north-deck", 307, 192, 324, 303);
plan("east-south-deck", 307, 318, 324, 431);
plan("north-west-crossing", 162, 192, 177, 218);
plan("north-east-crossing", 209, 192, 220, 218);
plan("middle-crossing", 162, 286, 220, 315);
plan("south-crossing", 162, 410, 220, 431);
plan("north-red-pit", 162, 218, 220, 286, -3.6, 0.6, 0x8a4f3d, "rust");
plan("south-red-pit", 162, 315, 220, 410, -3.6, 0.6, 0x8a4f3d, "rust");
for (const [name, z1, z2] of [
  ["north", 218, 286],
  ["south", 315, 410],
] as const) {
  plan(`${name}-pit-west`, 160, z1, 162, z2, 0, 3.6, 0x944c36, "rust");
  plan(
    `${name}-pit-east`,
    220,
    name === "south" ? 322 : z1,
    222,
    z2,
    0,
    3.6,
    0x944c36,
    "rust",
  );
}
// Lower north/south connector, open pits, and helipad-side exit.
plan("lower-between-pits", 176, 278, 207, 324, -3.6, 0.5, 0x764e3e, "rust");
plan("north-tunnel", 180, 176, 206, 218, -3.6, 0.5, 0x64695e);
plan("south-tunnel", 180, 410, 207, 465, -3.6, 0.5, 0x64695e);
plan("north-tunnel-west", 177, 177, 180, 218, 0, 3.6);
plan("north-tunnel-east", 206, 177, 209, 218, 0, 3.6);
plan("south-tunnel-west", 177, 410, 180, 465, 0, 3.6);
plan("south-tunnel-east", 207, 410, 210, 465, 0, 3.6);
plan("helipad-lower-exit", 205, 305, 324, 322, -3.6, 0.5, 0x64695e);
plan("helipad-tunnel-north", 222, 303, 307, 305, 0, 3.6);
plan("helipad-tunnel-south", 222, 322, 324, 324, 0, 3.6);
// Stair openings must stay open in upper floor slabs.
function stairs(
  id: string,
  x: number,
  z: number,
  side: number,
  base = -3.6,
  count = 15,
  width = 2.8,
) {
  for (let n = 0; n < count; n++) {
    const h = (n + 1) * 0.24;
    box(`${id}-${n}`, x, base + h / 2, z + side * n * 0.38, width, h, 0.38);
  }
}
stairs("north-lower-stairs", -9, -28.04, -1);
stairs("south-lower-stairs", -11.2, 29.8, 1);
// Helipad is offset east; top deck and stairs dominate the central silhouette.
plan("helipad", 238, 296, 299, 344, 2.4, 0.4, 0x5b6456, "roof");
for (const [x, z] of [
  [0.5, -3.7],
  [13.4, -3.7],
  [0.5, 6.5],
  [13.4, 6.5],
])
  box(`helipad-leg-${x}-${z}`, x, 1.05, z, 0.45, 2.1, 0.45, 0x6c6b53, "rust");
stairs("helipad-south", 7, 10.4, -1, 0, 10, 3.2);
// Two original utility enclosures and the east propane cover.
plan("power-center", 135, 263, 160, 300, 3.2, 3.2, 0x686f57);
plan("power-top", 133, 261, 162, 302, 3.35, 0.15, 0x4e5748, "roof");
plan("fence-shack", 259, 372, 305, 413, 2.9, 2.9, 0x63735f);
plan("fence-shack-roof", 257, 370, 307, 415, 3.05, 0.15, 0x455541, "roof");
plan("propane-shack", 303, 208, 321, 235, 2.2, 2.2, 0x869078);
plan("propane-tank", 292, 250, 309, 269, 1.6, 1.6, 0xb4ae91);
plan("pit-generator", 181, 283, 207, 299, 1.4, 1.4, 0x5b5a4e);
plan("middle-pallet", 242, 276, 256, 290, 1.1, 1.1, 0x827559, "wood");
plan("south-cover", 223, 348, 261, 358, 1.2, 1.2, 0x928b72);
plan("east-crates", 317, 330, 329, 344, 1.5, 1.5, 0x8e7957, "wood");
// North offices, mail/store wing, cafe and projecting eastern balcony.
plan("north-office-main-floor", 209, 123, 293, 192);
plan("north-office-west-floor", 187, 123, 209, 176);
plan("north-wing-floor", 120, 40, 187, 177);
plan("north-balcony", 293, 158, 350, 179);
plan("north-office-roof", 187, 123, 293, 192, 4.9, 0.3, 0x72776b, "roof");
plan("mail-roof", 120, 40, 187, 177, 4.9, 0.3, 0x72776b, "roof");
// Floors surround the lower stair aperture at x180..206, z176..218.
plan("north-stair-landing", 162, 177, 177, 192);
plan("north-stair-east-landing", 209, 177, 220, 192);
plan("north-back-wall", 187, 121, 293, 124, 4.7, 4.7, 0x66756d);
plan("mail-west-wall", 118, 40, 121, 179, 4.7, 4.7, 0x66756d);
plan("store-back-wall", 120, 38, 187, 41, 4.7, 4.7, 0x66756d);
plan("mail-east-wall", 184, 40, 187, 116, 4.7, 4.7, 0x66756d);
plan("north-east-wall", 291, 124, 294, 157, 4.7, 4.7, 0x66756d);
for (const [x1, x2] of [
  [187, 200],
  [217, 240],
  [259, 276],
  [290, 294],
])
  plan(`north-window-pier-${x1}`, x1, 190, x2, 193, 4.7, 4.7, 0x637368);
plan("mail-divider", 144, 72, 187, 75, 3.2, 3.2, 0x7e8677);
plan("mail-counter", 128, 100, 139, 152, 1, 1, 0x8a795c, "wood");
plan("cafe-counter", 247, 128, 282, 136, 1.1, 1.1, 0x8b7e63, "wood");
for (const [x, z] of [
  [203, 143],
  [224, 158],
  [252, 166],
  [158, 157],
])
  plan(`north-desk-${x}`, x, z, x + 12, z + 7, 1, 1, 0x8a7a60, "wood");
// South and executive offices: asymmetric partitioned rooms.
plan("south-main-floor", 210, 431, 284, 545);
plan("south-west-floor", 187, 462, 210, 545);
plan("executive-floor", 284, 450, 354, 548);
plan("south-west-wing", 152, 431, 177, 460);
plan("south-stair-side", 152, 463, 177, 545);
plan("south-office-roof", 187, 431, 284, 545, 4.9, 0.3, 0x72776b, "roof");
plan("executive-roof", 284, 450, 354, 548, 4.9, 0.3, 0x72776b, "roof");
plan("south-back-wall", 187, 543, 354, 546, 4.7, 4.7, 0x6a766a);
plan("executive-east-wall", 352, 450, 355, 548, 4.7, 4.7, 0x6a766a);
plan("south-west-wall", 185, 465, 188, 545, 4.7, 4.7, 0x6a766a);
for (const [x1, x2] of [
  [187, 202],
  [221, 240],
  [261, 284],
])
  plan(`south-window-pier-${x1}`, x1, 430, x2, 433, 4.7, 4.7, 0x637368);
plan("south-divider-a", 233, 448, 236, 486, 3.2, 3.2);
plan("south-divider-b", 257, 479, 260, 522, 3.2, 3.2);
plan("executive-divider", 284, 471, 287, 522, 3.2, 3.2);
for (const [x, z] of [
  [203, 473],
  [204, 516],
  [244, 501],
  [310, 490],
  [322, 527],
])
  plan(`south-desk-${x}`, x, z, x + 12, z + 7, 1, 1, 0x8a7a60, "wood");
// Crane and elevator flank: western route, tall boom parallel to the long lane.
box("crane-foundation", -28, 1.5, -8, 3, 3, 4, 0xa48c45, "rust");
box("crane-boom-walk", -28, 4, -4, 1.8, 0.25, 51, 0xb29948, "rust");
box("crane-top-beam", -28, 6.3, -4, 0.3, 0.3, 51, 0xa48b37, "rust");
for (let z = -29; z < 22; z += 5)
  for (const x of [-28.7, -27.3])
    box(`crane-frame-${x}-${z}`, x, 5.2, z, 0.15, 2.4, 0.15, 0xa48b37, "rust");
box("elevator-canopy", -24, 2.6, -1, 4, 0.2, 5, 0x72775e);
box("crane-north-link", -28.8, 4, -29, 3, 0.25, 1.4, 0x9b987f);
box("mail-exterior-ledge", -30, 4, -45, 1.2, 0.25, 29, 0x9a9d89);
// East suspended scaffolding -> south perimeter -> rooftop trickshot route.
box("scaffold-first", 25.3, 1.0, 24, 2, 0.25, 4, 0x9a855c, "rust");
box("scaffold-second", 26.3, 3.2, 29, 2, 0.25, 4, 0x9a855c, "rust");
box("executive-east-ledge", 28.15, 3.65, 44, 1.1, 0.25, 23, 0x9d9d87);
box("south-rear-ledge", 12, 3.65, 56.2, 33, 0.25, 1.1, 0x9d9d87);
for (const z of [22, 27, 31])
  for (const x of [24.5, 27.1])
    box(`scaffold-pole-${x}-${z}`, x, 2, z, 0.12, 5, 0.12, 0x7f7d61, "rust");
export const map: MapDefinition = {
  id: "highrise-v1",
  boxes,
  spawns: [
    { x: -5, y: 1, z: -38 },
    { x: 5, y: 1, z: 47 },
    { x: -26, y: 1, z: -54 },
    { x: 23, y: 1, z: 48 },
    { x: -21, y: 1, z: 22 },
    { x: 19, y: 1, z: -24 },
    { x: -14, y: -2.6, z: 14 },
    { x: -14, y: -2.6, z: -17 },
  ],
  ladders: [
    { p: { x: -27, y: 0, z: -8 }, top: 5 },
    { p: { x: 26.3, y: 1, z: 26.3 }, top: 4.6 },
    { p: { x: 18.96, y: -3.6, z: -0.96 }, top: 1.2 },
  ],
  mantles: [
    { p: { x: 27.8, y: 3.65, z: 53 }, target: { x: 26.2, y: 5.8, z: 53 } },
    { p: { x: -30, y: 4, z: -43 }, target: { x: -27.1, y: 5.8, z: -43 } },
    { p: { x: 9, y: 0, z: 13 }, target: { x: 9, y: 3.9, z: 14.5 } },
  ],
};
export function rayBox(o: Vec, d: Vec, p: Vec, s: Vec): number {
  let lo = 0,
    hi = 250;
  for (const k of ["x", "y", "z"] as const) {
    if (Math.abs(d[k]) < 1e-8) {
      if (o[k] < p[k] - s[k] / 2 || o[k] > p[k] + s[k] / 2) return Infinity;
    } else {
      let a = (p[k] - s[k] / 2 - o[k]) / d[k],
        b = (p[k] + s[k] / 2 - o[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}
export function wallDistance(o: Vec, d: Vec) {
  let t = 250;
  for (const b of boxes) t = Math.min(t, rayBox(o, d, b.p, b.s));
  return t;
}
