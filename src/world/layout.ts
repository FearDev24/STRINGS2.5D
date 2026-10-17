// Layout lógico do mundo (grade de células). Função pura: sem Three.js, testável.
// Uma célula = uma unidade de mundo. Só o que está em `solid` bloqueia o jogador.
import { mulberry32, range } from '../core/rng';

export interface Cell { x: number; z: number }
export interface House { id: string; x: number; z: number; w: number; d: number; kind: 'wood' | 'stone' }
export interface Prop { kind: 'barrel' | 'crate' | 'bush' | 'sign' | 'lantern' | 'stone'; x: number; z: number }

export const BOUNDS = { minX: -20, maxX: 60, minZ: -24, maxZ: 24 };
export const FOREST_X = 12;
export const PLAZA_RADIUS = 4.2;
export const PORTAL: Cell = { x: 0, z: 0 };
export const PLAYER_START: Cell = { x: 0, z: 3 };
export const HERALD: Cell = { x: 2, z: -2 };
export const VILLAGERS: Array<{ id: 'villager_a' | 'villager_b'; cell: Cell }> = [
  { id: 'villager_a', cell: { x: -4, z: 1 } },
  { id: 'villager_b', cell: { x: 4, z: 1 } },
];
export const HOUSES: House[] = [
  { id: 'ferreiro', x: -8, z: -5, w: 3, d: 3, kind: 'stone' },
  { id: 'tecelao', x: 5, z: -6, w: 3, d: 2, kind: 'wood' },
  { id: 'padeira', x: -9, z: 3, w: 2, d: 3, kind: 'wood' },
  { id: 'anciao', x: 6, z: 4, w: 3, d: 3, kind: 'stone' },
  { id: 'cabana', x: -3, z: -10, w: 2, d: 2, kind: 'wood' },
];
export const WELL: Cell = { x: -5, z: 0 };
export const LANTERNS: Cell[] = [{ x: -2, z: -3 }, { x: 2, z: 3 }, { x: -3, z: 1 }];
export const CLEARING = { x: 30, z: 0, r: 7 };
export const CORRUPT_ZONE = { x: 48, z: 9, r: 9 };
export const CREATURE_SPAWN: Cell = { x: 47, z: 8 };
export const FRAGMENTS: Array<{ id: 'eco_1' | 'eco_2' | 'eco_3'; cell: Cell }> = [
  { id: 'eco_1', cell: { x: 19, z: -6 } },
  { id: 'eco_2', cell: { x: 33, z: 6 } },
  { id: 'eco_3', cell: { x: 44, z: -8 } },
];

// Cercas: segmentos de células bloqueadas. Há uma abertura em z = -1..1 para o bosque.
export function fenceCells(): Cell[] {
  const out: Cell[] = [];
  for (let z = -14; z <= -2; z++) out.push({ x: FOREST_X - 1, z });
  for (let z = 2; z <= 14; z++) out.push({ x: FOREST_X - 1, z });
  for (let x = -12; x <= -5; x++) out.push({ x, z: 7 });
  for (let x = -1; x <= 3; x++) out.push({ x, z: -9 });
  return out;
}

// Decoração não bloqueante (barris, caixas, arbustos, placa).
export const PROPS: Array<Prop & { cell: Cell }> = [
  { kind: 'barrel', x: -7, z: -2, cell: { x: -7, z: -2 } },
  { kind: 'barrel', x: -6, z: -2, cell: { x: -6, z: -2 } },
  { kind: 'crate', x: 8, z: -2, cell: { x: 8, z: -2 } },
  { kind: 'crate', x: 8, z: -1, cell: { x: 8, z: -1 } },
  { kind: 'sign', x: 2, z: 1, cell: { x: 2, z: 1 } },
  { kind: 'bush', x: -6, z: 7, cell: { x: -6, z: 7 } },
  { kind: 'bush', x: 9, z: 8, cell: { x: 9, z: 8 } },
  { kind: 'stone', x: 1, z: -8, cell: { x: 1, z: -8 } },
];

// Caminho de terra: da praça até a abertura da cerca e depois para a clareira.
export const PATH_CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let x = 3; x <= 30; x++) {
    out.push({ x, z: 0 });
    if (x > 20) out.push({ x, z: 1 });
  }
  return out;
})();

export function isInHouse(x: number, z: number): HouseHit | null {
  for (const h of HOUSES) {
    if (x >= h.x && x < h.x + h.w && z >= h.z && z < h.z + h.d) return { house: h };
  }
  return null;
}
export interface HouseHit { house: House }

export function isInCorruptZone(x: number, z: number): boolean {
  return Math.hypot(x - CORRUPT_ZONE.x, z - CORRUPT_ZONE.z) <= CORRUPT_ZONE.r;
}
export function isInClearing(x: number, z: number): boolean {
  return Math.hypot(x - CLEARING.x, z - CLEARING.z) <= CLEARING.r;
}

// Árvores: posições determinísticas. `count` pega as primeiras N válidas, então um preset maior
// inclui todas as árvores do preset menor.
const MAX_TREES = 200;
let treeCache: Cell[] | null = null;
export function treeCandidates(): Cell[] {
  if (treeCache) return treeCache;
  const rng = mulberry32(20260917);
  const out: Cell[] = [];
  const blockedFixed = new Set<string>();
  for (const f of FRAGMENTS) blockedFixed.add(key(f.cell.x, f.cell.z));
  for (const c of fenceCells()) blockedFixed.add(key(c.x, c.z));
  for (const p of PATH_CELLS) blockedFixed.add(key(p.x, p.z));
  for (let i = 0; i < 9000 && out.length < MAX_TREES; i++) {
    const x = Math.round(range(rng, BOUNDS.minX + 1, BOUNDS.maxX - 1));
    const z = Math.round(range(rng, BOUNDS.minZ + 1, BOUNDS.maxZ - 1));
    if (Math.hypot(x, z) < 8) continue; // vila sem árvores no centro
    if (isInHouse(x, z) || blockedFixed.has(key(x, z))) continue;
    if (Math.abs(z) <= 2 && x > 10 && x < 26) continue; // corredor do caminho
    if (isInClearing(x, z) && rng() < 0.85) continue; // clareira quase livre
    if (x < 12 && Math.abs(x) < 12 && Math.abs(z) < 12) continue; // vila mais aberta
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
    out.push({ x, z });
  }
  treeCache = out;
  return out;
}
export function treesFor(count: number): Cell[] {
  return treeCandidates().slice(0, count);
}

export function key(x: number, z: number): string {
  return `${x},${z}`;
}

export interface WorldGrid {
  isSolid(x: number, z: number): boolean;
  inBounds(x: number, z: number): boolean;
}

// Grade de colisão a partir do layout. Não depende de quantas árvores são visíveis:
// as árvores do preset atual entram com `treeCount`.
export function createGrid(treeCount: number): WorldGrid {
  const solid = new Set<string>();
  for (const h of HOUSES) for (let x = h.x; x < h.x + h.w; x++) for (let z = h.z; z < h.z + h.d; z++) solid.add(key(x, z));
  for (const c of fenceCells()) solid.add(key(c.x, c.z));
  for (const l of LANTERNS) solid.add(key(l.x, l.z));
  solid.add(key(WELL.x, WELL.z));
  solid.add(key(PORTAL.x, PORTAL.z));
  for (const t of treesFor(treeCount)) solid.add(key(t.x, t.z));
  return {
    isSolid: (x, z) => solid.has(key(x, z)) || !inBoundsRaw(x, z),
    inBounds: (x, z) => inBoundsRaw(x, z),
  };
}
function inBoundsRaw(x: number, z: number): boolean {
  return x >= BOUNDS.minX && x <= BOUNDS.maxX && z >= BOUNDS.minZ && z <= BOUNDS.maxZ;
}
