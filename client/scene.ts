import * as T from "three";
import { map } from "../shared/map.ts";
import type { PlayerState } from "../shared/types.ts";
export const scene = new T.Scene();
scene.background = new T.Color(0x9da89d);
scene.fog = new T.Fog(0x9da89d, 65, 230);
scene.add(new T.AmbientLight(0xa9b7a1, 0.6));
scene.add(new T.HemisphereLight(0xd9e4d1, 0x404840, 2.2));
const sun = new T.DirectionalLight(0xffe5bb, 2);
sun.position.set(-30, 70, -20);
scene.add(sun);
const materials = new Map<string, T.MeshLambertMaterial>();
function texture(seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!,
    im = ctx.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 150 + (seed % 65);
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
const textures = {
  concrete: texture(12),
  rust: texture(38),
  roof: texture(65),
  wood: texture(92),
};
for (const b of map.boxes) {
  const key = `${b.color}-${b.material}`;
  if (!materials.has(key))
    materials.set(
      key,
      new T.MeshLambertMaterial({
        color: b.color,
        map: textures[b.material as keyof typeof textures] || textures.concrete,
      }),
    );
  const m = new T.Mesh(
    new T.BoxGeometry(b.s.x, b.s.y, b.s.z),
    materials.get(key),
  );
  m.position.set(b.p.x, b.p.y, b.p.z);
  scene.add(m);
}
function label(
  text: string,
  x: number,
  y: number,
  z: number,
  size = 4,
  rotation = -Math.PI / 2,
) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d2ccab";
  ctx.font = "bold 90px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 98);
  const m = new T.Mesh(
    new T.PlaneGeometry(size, size / 2),
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.x = rotation;
  scene.add(m);
}
label("H", 6.8, 2.41, 1, 9);
label("NORTH", -2, 3.5, -45.8, 7, 0);
label("SOUTH", 1, 3.5, 54.5, 7, 0);
for (const l of map.ladders) {
  for (let y = l.p.y; y < l.top; y += 0.4) {
    const m = new T.Mesh(
      new T.BoxGeometry(1.2, 0.07, 0.1),
      new T.MeshLambertMaterial({ color: 0xc4a761 }),
    );
    m.position.set(l.p.x, y, l.p.z);
    scene.add(m);
  }
}
// Distant skyline is decorative only; deterministic, original geometry.
const skylineMat = new T.MeshLambertMaterial({ color: 0x697c73 });
for (let n = 0; n < 60; n++) {
  const a = n * 2.3999,
    r = 85 + (n % 5) * 15,
    h = 15 + ((n * 17) % 70);
  const m = new T.Mesh(
    new T.BoxGeometry(8 + (n % 9), h, 8 + (n % 6)),
    skylineMat,
  );
  m.position.set(Math.sin(a) * r, h / 2 - 65, Math.cos(a) * r);
  scene.add(m);
}
export function avatar() {
  const g = new T.Group();
  const uniform = new T.MeshLambertMaterial({ color: 0x46594d }),
    skin = new T.MeshLambertMaterial({ color: 0xb4a48a });
  const parts: [
    [number, number, number],
    [number, number, number],
    T.Material,
  ][] = [
    [[0.55, 0.7, 0.35], [0, 0.1, 0], uniform],
    [[0.36, 0.36, 0.36], [0, 0.65, 0], skin],
    [[0.2, 0.65, 0.22], [-0.18, -0.55, 0], uniform],
    [[0.2, 0.65, 0.22], [0.18, -0.55, 0], uniform],
    [[0.18, 0.6, 0.2], [-0.38, 0.08, -0.08], uniform],
    [[0.18, 0.6, 0.2], [0.38, 0.08, -0.08], uniform],
    [[0.12, 0.14, 0.9], [0.28, 0.22, -0.4], uniform],
  ];
  for (const [s, p, m] of parts) {
    const mesh = new T.Mesh(new T.BoxGeometry(...s), m);
    mesh.position.set(...p);
    g.add(mesh);
  }
  return g;
}
export function poseAvatar(g: T.Group, p: PlayerState, time: number) {
  g.scale.y = p.crouch ? 0.65 : 1;
  g.position.set(p.p.x, p.p.y, p.p.z);
  g.rotation.y = p.yaw;
  g.visible = p.health > 0;
  g.children[6].rotation.x = p.pitch;
  g.children[6].scale.z = p.weapon === 1 ? 0.4 : 1;
  const stride = p.grounded ? Math.sin(time * 0.013) * 0.1 : 0;
  g.children[2].rotation.x = stride;
  g.children[3].rotation.x = -stride;
}
export function gun(pistol = false) {
  const g = new T.Group(),
    metal = new T.MeshStandardMaterial({
      color: 0x353d38,
      roughness: 0.45,
      metalness: 0.7,
    }),
    stock = new T.MeshLambertMaterial({ color: 0x66674e }),
    skin = new T.MeshLambertMaterial({ color: 0xa39b7c });
  function part(s: number[], p: number[], mat: T.Material) {
    const m = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), mat);
    m.position.set(p[0], p[1], p[2]);
    g.add(m);
    return m;
  }
  function cylinder(
    radius: number,
    length: number,
    p: number[],
    mat: T.Material,
  ) {
    const m = new T.Mesh(
      new T.CylinderGeometry(radius, radius, length, 10),
      mat,
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(p[0], p[1], p[2]);
    g.add(m);
    return m;
  }
  if (pistol) {
    part([0.09, 0.12, 0.32], [0, 0, -0.15], metal);
    part([0.08, 0.2, 0.1], [0, -0.12, -0.05], stock);
  } else {
    part([0.12, 0.16, 0.65], [0, 0, -0.3], stock);
    cylinder(0.033, 0.62, [0, 0.015, -0.85], metal);
    cylinder(0.065, 0.3, [0, 0.17, -0.3], metal);
    part([0.1, 0.08, 0.12], [0, 0.1, -0.3], metal);
    part([0.16, 0.2, 0.25], [0, -0.03, 0.08], stock);
    part([0.065, 0.04, 0.12], [0.1, 0.02, -0.15], metal);
    part([0.05, 0.2, 0.05], [-0.08, -0.14, -0.68], metal);
    part([0.05, 0.2, 0.05], [0.08, -0.14, -0.68], metal);
  }
  part([0.1, 0.11, 0.32], [0.03, -0.14, 0.06], skin);
  part([0.12, 0.12, 0.35], [-0.15, -0.11, -0.23], skin);
  if (!pistol) {
    cylinder(
      0.058,
      0.006,
      [0, 0.17, -0.146],
      new T.MeshBasicMaterial({ color: 0x183b39 }),
    );
    part([0.06, 0.05, 0.06], [0, 0.24, -0.3], metal);
    part([0.08, 0.18, 0.08], [0, -0.13, -0.23], metal);
  }
  return g;
}
