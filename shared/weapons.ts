import {
  B,
  type PlayerState,
  type Input,
  type WeaponDefinition,
  type LoadoutDefinition,
  type GameMode,
} from "./types.ts";
export const weapons: WeaponDefinition[] = [
  {
    id: 0,
    name: "Intervention",
    magazine: 7,
    adsMs: 250,
    cycleMs: 1000,
    reloadMs: 2500,
    damage: { head: 150, upper: 110, lower: 70, limb: 50 },
  },
  {
    id: 1,
    name: "Pistol",
    magazine: 12,
    adsMs: 150,
    cycleMs: 250,
    reloadMs: 1400,
    damage: { head: 68, upper: 34, lower: 34, limb: 34 },
  },
];
export const loadout: LoadoutDefinition = { id: "quickscope", weapons };
export const mode: GameMode = { target: 15, capacity: 18, respawnMs: 2000 };
export function updateWeapon(
  p: PlayerState,
  i: Input,
  now: number,
  dt: number,
): boolean {
  for (let w = 0; w < 2; w++) {
    const g = p.guns[w];
    if (g.reloadEnd && now >= g.reloadEnd) {
      g.ammo = weapons[w].magazine;
      g.reloadEnd = 0;
    }
  }
  if (i.weapon !== p.weapon && now >= p.switchEnd) {
    p.weapon = i.weapon;
    p.switchEnd = now + 350;
    p.ads = 0;
  }
  const g = p.guns[p.weapon],
    w = weapons[p.weapon];
  const aim =
    !!(i.buttons & B.ads) &&
    !(i.buttons & B.sprint) &&
    now >= p.switchEnd &&
    !g.reloadEnd;
  p.ads = Math.max(0, Math.min(1, p.ads + ((aim ? 1 : -1) * dt) / w.adsMs));
  if (
    i.buttons & B.reload &&
    !g.reloadEnd &&
    g.ammo < w.magazine &&
    now >= g.ready &&
    now >= p.switchEnd
  )
    g.reloadEnd = now + w.reloadMs;
  if (
    !(i.buttons & B.fire) ||
    now < g.ready ||
    g.reloadEnd ||
    now < p.switchEnd ||
    !g.ammo ||
    i.buttons & B.sprint
  )
    return false;
  g.ammo--;
  g.ready = now + w.cycleMs;
  p.protectedUntil = 0;
  return true;
}
