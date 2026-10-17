import { describe, it, expect } from 'vitest';
import { createGrid, treesFor, PLAYER_START, FRAGMENTS, CREATURE_SPAWN, HERALD, PORTAL, VILLAGERS, BOUNDS, PLAZA_RADIUS, HOUSES } from '../src/world/layout';
import { PRESETS } from '../src/core/config';

// Busca em largura sobre células livres: prova que o jogador consegue chegar a cada ponto de interesse.
function reachable(treeCount: number): Set<string> {
  const grid = createGrid(treeCount);
  const seen = new Set<string>([`${PLAYER_START.x},${PLAYER_START.z}`]);
  const queue = [PLAYER_START];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, nz = c.z + dz;
      const k = `${nx},${nz}`;
      if (seen.has(k) || grid.isSolid(nx, nz)) continue;
      seen.add(k);
      queue.push({ x: nx, z: nz });
    }
  }
  return seen;
}

describe('layout do mundo', () => {
  it('todos os pontos de interesse são alcançáveis a partir do início (preset alto)', () => {
    const r = reachable(PRESETS.alto.treeCount);
    for (const f of FRAGMENTS) expect(r.has(`${f.cell.x},${f.cell.z}`), f.id).toBe(true);
    expect(r.has(`${CREATURE_SPAWN.x},${CREATURE_SPAWN.z}`)).toBe(true);
    for (const v of VILLAGERS) expect(r.has(`${v.cell.x},${v.cell.z}`), v.id).toBe(true);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([dx, dz]) => r.has(`${HERALD.x + dx},${HERALD.z + dz}`));
    expect(near).toBe(true);
  });

  it('todos os presets deixam os fragmentos alcançáveis', () => {
    for (const name of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) {
      const r = reachable(PRESETS[name].treeCount);
      for (const f of FRAGMENTS) expect(r.has(`${f.cell.x},${f.cell.z}`), `${name}:${f.id}`).toBe(true);
    }
  });

  it('o portal e os fragmentos não ficam sobre sólidos', () => {
    const grid = createGrid(PRESETS.alto.treeCount);
    expect(grid.isSolid(PORTAL.x, PORTAL.z)).toBe(true); // o pedestal é sólido
    for (const f of FRAGMENTS) expect(grid.isSolid(f.cell.x, f.cell.z)).toBe(false);
  });

  it('casas não invadem a praça central', () => {
    for (const h of HOUSES) {
      for (let x = h.x; x < h.x + h.w; x++) for (let z = h.z; z < h.z + h.d; z++) {
        expect(Math.hypot(x - PORTAL.x, z - PORTAL.z)).toBeGreaterThan(PLAZA_RADIUS);
      }
    }
  });

  it('árvores são determinísticas e um preset maior contém o menor', () => {
    const small = treesFor(PRESETS.baixo.treeCount);
    const big = treesFor(PRESETS.alto.treeCount);
    expect(small).toEqual(big.slice(0, small.length));
    expect(big.length).toBe(PRESETS.alto.treeCount);
    for (const t of big) {
      expect(t.x).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(t.x).toBeLessThanOrEqual(BOUNDS.maxX);
    }
  });

  it('o limite do mundo bloqueia a saída', () => {
    const grid = createGrid(0);
    expect(grid.isSolid(BOUNDS.maxX + 1, 0)).toBe(true);
    expect(grid.inBounds(BOUNDS.minX, BOUNDS.minZ)).toBe(true);
  });
});

describe('presets gráficos', () => {
  it('a qualidade cresce do baixo para o alto', () => {
    expect(PRESETS.baixo.grassBlades).toBeLessThan(PRESETS.medio.grassBlades);
    expect(PRESETS.medio.grassBlades).toBeLessThan(PRESETS.alto.grassBlades);
    expect(PRESETS.baixo.treeCount).toBeLessThan(PRESETS.alto.treeCount);
    expect(PRESETS.baixo.fireflies).toBeLessThan(PRESETS.alto.fireflies);
    expect(PRESETS.baixo.renderScale).toBeLessThan(PRESETS.alto.renderScale);
  });

  it('o preset baixo desliga os efeitos caros', () => {
    const t = PRESETS.baixo.toggles;
    expect(t.shadows || t.ao || t.bloom || t.dof || t.godRays).toBe(false);
  });
});
