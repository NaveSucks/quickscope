export type Vec = { x: number; y: number; z: number };
export interface WeaponDefinition {
  id: number;
  name: string;
  magazine: number;
  adsMs: number;
  cycleMs: number;
  reloadMs: number;
  damage: Record<"head" | "upper" | "lower" | "limb", number>;
}
export interface LoadoutDefinition {
  id: string;
  weapons: WeaponDefinition[];
}
export interface GameMode {
  target: number;
  capacity: number;
  respawnMs: number;
}
export interface MapBox {
  id: string;
  p: Vec;
  s: Vec;
  color: number;
  material?: string;
}
export interface MapDefinition {
  id: string;
  boxes: MapBox[];
  spawns: Vec[];
  ladders: { p: Vec; top: number }[];
  mantles: { p: Vec; target: Vec }[];
}
export interface Input {
  seq: number;
  time: number;
  yaw: number;
  pitch: number;
  buttons: number;
  weapon: number;
}
export const B = {
  forward: 1,
  back: 2,
  left: 4,
  right: 8,
  jump: 16,
  sprint: 32,
  crouch: 64,
  ads: 128,
  fire: 256,
  reload: 512,
};
export interface GunState {
  ammo: number;
  ready: number;
  reloadEnd: number;
}
export interface PlayerState {
  life: number;
  moving: boolean;
  sprinting: boolean;
  id: number;
  name: string;
  p: Vec;
  vy: number;
  grounded: boolean;
  crouch: boolean;
  yaw: number;
  pitch: number;
  health: number;
  kills: number;
  deaths: number;
  weapon: number;
  guns: GunState[];
  ads: number;
  switchEnd: number;
  protectedUntil: number;
  respawnAt: number;
  lastDamage: number;
  ack: number;
}
export type Phase = "waiting" | "countdown" | "active" | "replay" | "results";
export interface Snapshot {
  time: number;
  phase: Phase;
  until: number;
  players: PlayerState[];
}
export type GameEvent =
  | {
      type: "shot";
      time: number;
      id: number;
      weapon: number;
      from: Vec;
      to: Vec;
      hit?: number;
      pose?: PlayerState;
    }
  | { type: "death"; time: number; id: number; killer?: number }
  | { type: "phase"; time: number; phase: Phase; until: number }
  | { type: "welcome"; id: number; names: Record<number, string> }
  | { type: "roster"; names: Record<number, string> }
  | {
      type: "replay";
      index: number;
      total: number;
      winner: number;
      impact: number;
      frames: Snapshot[];
      events: GameEvent[];
    };
