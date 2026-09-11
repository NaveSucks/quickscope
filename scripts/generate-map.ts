import { map } from "../shared/map.ts";
import { writeFileSync } from "node:fs";
const x = (v: number) => 100 + (v + 32) * 8,
  z = (v: number) => 70 + (v + 68) * 8;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1180"><rect width="900" height="1180" fill="#101c17"/><style>text{font-family:system-ui,sans-serif;fill:#edf0dd}.label{font-size:12px;font-weight:bold}.note{fill:#a8b9a6;font-size:14px}</style><text x="40" y="40" font-size="26" font-weight="bold">QUICKSCOPE · HIGHRISE</text><text x="40" y="64" class="note">Authored geometry and traversal review · metres, Y up</text>`,
];
for (const b of [...map.boxes].sort(
  (a, b) => a.p.y + a.s.y / 2 - (b.p.y + b.s.y / 2),
)) {
  const roof = b.id.includes("roof");
  parts.push(
    `<rect x="${x(b.p.x - b.s.x / 2).toFixed(1)}" y="${z(b.p.z - b.s.z / 2).toFixed(1)}" width="${(b.s.x * 8).toFixed(1)}" height="${(b.s.z * 8).toFixed(1)}" fill="#${b.color.toString(16).padStart(6, "0")}" fill-opacity="${roof ? 0.18 : 0.9}" stroke="#cad4b0" stroke-opacity=".25" stroke-width=".5"><title>${b.id} · top ${(b.p.y + b.s.y / 2).toFixed(2)}m</title></rect>`,
  );
}
const routes = [
  {
    color: "#c5d894",
    points: [
      [-23, -8],
      [-28, -8],
      [-28, -29],
      [-30, -32],
      [-30, -43],
      [-27, -43],
    ],
  },
  {
    color: "#e5bc78",
    points: [
      [21, 24],
      [25.3, 24],
      [26.3, 29],
      [28.15, 34],
      [28.15, 53],
      [26.2, 53],
    ],
  },
];
for (const r of routes)
  parts.push(
    `<polyline points="${r.points.map(([a, b]) => `${x(a)},${z(b)}`).join(" ")}" fill="none" stroke="${r.color}" stroke-width="2" stroke-dasharray="5 4"/>`,
  );
for (let n = 0; n < map.spawns.length; n++) {
  const p = map.spawns[n];
  parts.push(
    `<circle cx="${x(p.x)}" cy="${z(p.z)}" r="7" fill="#1a3527" stroke="#c5d894"/><text x="${x(p.x)}" y="${z(p.z) + 3}" text-anchor="middle" font-size="9">${n + 1}</text>`,
  );
}
for (const [text, a, b] of [
  ["MAIL / STORE", -24, -59],
  ["NORTH OFFICES", -4, -38],
  ["NORTH PIT", -13, -16],
  ["SOUTH PIT", -13, 12],
  ["H", 7, 1],
  ["SOUTH OFFICES", 0, 39],
  ["EXECUTIVE", 22, 48],
] as const)
  parts.push(
    `<text class="label" x="${x(a)}" y="${z(b)}" text-anchor="middle">${text}</text>`,
  );
parts.push(
  `<text x="640" y="140" class="label">TRAVERSAL</text><text x="640" y="172" class="note">Green: crane / mail roof</text><text x="640" y="198" class="note">Amber: scaffold / south roof</text><text x="640" y="224" class="note">Circles: spawn locations</text><text x="640" y="276" class="label">LEVELS</text><text x="640" y="307" class="note">Office roof +4.9m</text><text x="640" y="333" class="note">Helipad +2.4m</text><text x="640" y="359" class="note">Main deck 0m</text><text x="640" y="385" class="note">Lower route −3.6m</text><text x="40" y="1115" class="note">Stairs, ladders, roof mantles and all spawns have automated collision checks.</text><text x="40" y="1140" class="note">Original-game fidelity, trickshot jumps and feel still require a human playtest.</text></svg>`,
);
writeFileSync("docs/map.svg", parts.join("\n"));
console.log("Generated docs/map.svg from shared/map.ts");
