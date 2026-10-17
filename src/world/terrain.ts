// Terreno: altura suave, cor por região (vila clara, bosque escuro, zona corrompida roxa)
// e os caminhos de terra/praça. A altura usada aqui é a mesma usada por todos os objetos.
import * as THREE from 'three';
import { Assets } from '../render/assets';
import { BOUNDS, CORRUPT_ZONE, PATH_CELLS, PLAZA_RADIUS, FOREST_X } from './layout';

export const TERRAIN = {
  cx: (BOUNDS.minX + BOUNDS.maxX) / 2,
  cz: (BOUNDS.minZ + BOUNDS.maxZ) / 2,
  w: BOUNDS.maxX - BOUNDS.minX + 8,
  d: BOUNDS.maxZ - BOUNDS.minZ + 8,
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Altura do chão. A vila é plana; o bosque ganha ondulações suaves. */
export function heightAt(x: number, z: number): number {
  const forest = smooth(FOREST_X - 3, FOREST_X + 3, x);
  // Faixa plana ao redor do caminho de terra (z ≈ 0), para que as peças do caminho assentem no chão.
  const flatPath = smooth(0.8, 2.4, Math.abs(z - 0.5));
  const h = 0.22 * Math.sin(x * 0.31) * Math.cos(z * 0.27)
    + 0.12 * Math.sin(x * 0.83 + z * 0.61)
    + 0.08 * Math.cos(z * 0.9 - x * 0.4);
  return h * forest * flatPath;
}

export function buildTerrain(assets: Assets): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN.w, TERRAIN.d, 180, 120);
  geo.rotateX(-Math.PI / 2);
  geo.translate(TERRAIN.cx, 0, TERRAIN.cz);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const village = new THREE.Color('#8ec45a');
  const forest = new THREE.Color('#4f8a3a');
  const corrupt = new THREE.Color('#3c2250');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const f = smooth(FOREST_X - 4, FOREST_X + 6, x);
    c.copy(village).lerp(forest, f);
    const dc = Math.hypot(x - CORRUPT_ZONE.x, z - CORRUPT_ZONE.z);
    const cz = 1 - smooth(CORRUPT_ZONE.r * 0.6, CORRUPT_ZONE.r * 1.4, dc);
    c.lerp(corrupt, cz * 0.85);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: assets.tiled('grass_ground', TERRAIN.w / 4, TERRAIN.d / 4),
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Praça de pedra e caminho de terra. Ficam levemente acima do chão para evitar z-fighting. */
export function buildPlazaAndPath(assets: Assets): THREE.Group {
  const g = new THREE.Group();
  g.name = 'plaza-path';
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(PLAZA_RADIUS, 48),
    new THREE.MeshStandardMaterial({ map: assets.tiled('stone_plaza', 3, 3), roughness: 0.85 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.03;
  plaza.receiveShadow = true;
  g.add(plaza);

  const pathGeo = new THREE.PlaneGeometry(1, 1);
  pathGeo.rotateX(-Math.PI / 2);
  const pathMat = new THREE.MeshStandardMaterial({ map: assets.tiled('dirt_path', 1, 1), roughness: 1 });
  const path = new THREE.InstancedMesh(pathGeo, pathMat, PATH_CELLS.length);
  const m = new THREE.Matrix4();
  PATH_CELLS.forEach((cell, i) => {
    const y = heightAt(cell.x, cell.z) + 0.02;
    m.makeTranslation(cell.x, y, cell.z);
    path.setMatrixAt(i, m);
  });
  path.receiveShadow = true;
  g.add(path);
  return g;
}
