// Vegetação: grama instanciada com vento, flores, samambaias, cogumelos, árvores com copas
// em camadas, raízes e rochas. Também cria a zona corrompida. Tudo usa InstancedMesh.
import * as THREE from 'three';
import { Assets } from '../render/assets';
import { WindUniforms, withWind, tint } from '../render/materials';
import { Preset } from '../core/config';
import { mulberry32, range } from '../core/rng';
import { WorldGrid, BOUNDS, PATH_CELLS, PLAZA_RADIUS, PORTAL, CORRUPT_ZONE, FOREST_X, treesFor, isInClearing, isInCorruptZone, key } from './layout';
import { heightAt } from './terrain';

export interface Vegetation {
  group: THREE.Group;
  stats: { grass: number; flowers: number; trees: number; treeCanopies: number };
  /** Oculta copas que estão entre a câmera e o jogador (ocultação por escala zero). */
  updateOcclusion(camPos: THREE.Vector3, playerPos: THREE.Vector3): number;
  dispose(): void;
}

interface CanopyRecord { mesh: THREE.InstancedMesh; idx: number; base: THREE.Matrix4 }
interface TreeRecord { center: THREE.Vector3; radius: number; records: CanopyRecord[]; hidden: boolean }

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const dummy = new THREE.Object3D();

function place(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, s: number, rx = 0, sx = s) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(rx, ry, 0);
  dummy.scale.set(sx, s, sx);
  dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix);
  return dummy.matrix.clone();
}

function isFreeCell(grid: WorldGrid, x: number, z: number, pathSet: Set<string>): boolean {
  const cx = Math.round(x), cz = Math.round(z);
  if (grid.isSolid(cx, cz)) return false;
  if (pathSet.has(key(cx, cz))) return false;
  if (Math.hypot(x - PORTAL.x, z - PORTAL.z) < PLAZA_RADIUS + 0.4) return false;
  return true;
}

export function buildVegetation(opts: { assets: Assets; preset: Preset; grid: WorldGrid; wind: WindUniforms }): Vegetation {
  const { assets, preset, grid, wind } = opts;
  const rng = mulberry32(4242);
  const group = new THREE.Group();
  group.name = 'vegetation';
  const pathSet = new Set(PATH_CELLS.map((c) => key(c.x, c.z)));
  const stats = { grass: 0, flowers: 0, trees: 0, treeCanopies: 0 };
  const disposables: Array<{ dispose(): void }> = [];

  // ----- grama
  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0, 0.5, 0, 0, -0.38, 0.35, 0, 0.38, 0.35, 0, -0.22, 0.7, 0, 0.22, 0.7, 0, 0, 1, 0,
  ], 3));
  bladeGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  bladeGeo.computeVertexNormals();
  const grassMat = withWind(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), wind, 0.11);
  const grassCount = preset.grassBlades;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grass.receiveShadow = true;
  grass.name = 'grass';
  const greens = ['#5fa53a', '#7bbd4a', '#4b8f32', '#8fc85a', '#6aa844', '#b7cf5e'].map((h) => new THREE.Color(h));
  const corruptGreen = new THREE.Color('#6a4a7a');
  let placed = 0;
  let clumpX = 0, clumpZ = 0, clumpLeft = 0;
  for (let attempts = 0; placed < grassCount && attempts < grassCount * 8; attempts++) {
    if (clumpLeft <= 0) {
      clumpX = range(rng, BOUNDS.minX + 1, BOUNDS.maxX - 1);
      clumpZ = range(rng, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
      clumpLeft = 6 + Math.floor(rng() * 12);
    }
    clumpLeft--;
    const x = clumpX + range(rng, -0.9, 0.9);
    const z = clumpZ + range(rng, -0.9, 0.9);
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) continue;
    if (!isFreeCell(grid, x, z, pathSet)) continue;
    const forest = x > FOREST_X ? 1 : 0.55;
    const h = range(rng, 0.35, 0.95) * (0.8 + 0.4 * forest);
    const w = range(rng, 0.06, 0.1);
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.set(range(rng, -0.12, 0.12), rng() * Math.PI * 2, range(rng, -0.25, 0.25));
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    const base = greens[Math.floor(rng() * greens.length)].clone().multiplyScalar(0.75 + forest * 0.2);
    if (isInCorruptZone(x, z)) base.lerp(corruptGreen, 0.55);
    grass.setColorAt(placed, base);
    placed++;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  stats.grass = placed;
  group.add(grass);
  disposables.push(bladeGeo, grassMat, grass);

  // ----- flores (8 variantes, agrupadas em moitas)
  const flowerTextures = Array.from({ length: 8 }, (_, i) => assets.frame('flowers', `flower_${i}`));
  const flowerPos: Array<{ x: number; z: number; v: number }> = [];
  for (let i = 0; i < preset.flowerCount; i++) {
    const cx = range(rng, BOUNDS.minX + 1, BOUNDS.maxX - 1);
    const cz = range(rng, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
    const size = Math.floor(range(rng, 2, 7));
    for (let k = 0; k < size && flowerPos.length < preset.flowerCount; k++) {
      const x = cx + range(rng, -1.4, 1.4), z = cz + range(rng, -1.4, 1.4);
      if (!isFreeCell(grid, x, z, pathSet)) continue;
      flowerPos.push({ x, z, v: Math.floor(rng() * 8) });
    }
  }
  const flowerGeo = new THREE.PlaneGeometry(0.34, 0.34);
  flowerGeo.translate(0, 0.17, 0);
  for (let v = 0; v < 8; v++) {
    const list = flowerPos.filter((f) => f.v === v);
    if (!list.length) continue;
    const mat = withWind(new THREE.MeshStandardMaterial({ map: flowerTextures[v], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), wind, 0.03);
    const m = new THREE.InstancedMesh(flowerGeo, mat, list.length);
    list.forEach((f, i) => place(m, i, f.x, heightAt(f.x, f.z) + 0.02, f.z, rng() * Math.PI * 2, 1 + rng() * 0.4));
    m.instanceMatrix.needsUpdate = true;
    group.add(m);
    stats.flowers += list.length;
    disposables.push(mat, m);
  }
  disposables.push(flowerGeo);

  // ----- trees
  const trees = treesFor(preset.treeCount);
  stats.trees = trees.length;
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.24, 1, 7, 3);
  trunkGeo.translate(0, 0.5, 0);
  const barkMat = new THREE.MeshStandardMaterial({ map: assets.tiled('bark', 1, 2), roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, trees.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trunks.name = 'trunks';
  const coreGeo = new THREE.IcosahedronGeometry(1, 1);
  // Núcleo de copa: verde médio para não virar um bloco preto na sombra quando a câmera passa perto.
  const coreMat = withWind(new THREE.MeshStandardMaterial({ color: '#4a8a3a', roughness: 1, flatShading: true }), wind, 0.02);
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, trees.length);
  cores.castShadow = true;
  cores.name = 'canopy-cores';

  const canopyTex = [0, 1, 2, 3].map((k) => assets.frame('leaf_clusters', `cluster_${k}`));
  const canopyPlanes = 7;
  const canopyGeo = new THREE.PlaneGeometry(1, 1);
  const canopyMats = canopyTex.map((t) => withWind(new THREE.MeshStandardMaterial({
    map: t, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85,
  }), wind, 0.05));
  const canopyMeshes = canopyTex.map(() => new THREE.InstancedMesh(canopyGeo, undefined as unknown as THREE.Material, trees.length * canopyPlanes));
  canopyMeshes.forEach((m, k) => {
    m.material = canopyMats[k];
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    m.name = `canopy-${k}`;
  });
  const counts = [0, 0, 0, 0];
  const treeRecords: TreeRecord[] = [];
  const coreBase: THREE.Matrix4[] = [];
  trees.forEach((t, i) => {
    const trunkH = range(rng, 3.4, 4.6);
    const corrupt = isInCorruptZone(t.x, t.z);
    const ground = heightAt(t.x, t.z);
    const tintK = tint(new THREE.Color('#ffffff'), i);
    if (corrupt) tintK.lerp(new THREE.Color('#9a5ab0'), 0.6);
    dummy.position.set(t.x, ground, t.z);
    dummy.rotation.set(0, rng() * 6.28, 0);
    dummy.scale.set(range(rng, 0.9, 1.25), trunkH, range(rng, 0.9, 1.25));
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    trunks.setColorAt(i, corrupt ? new THREE.Color('#7a5a8a') : new THREE.Color('#ffffff'));
    const cy = ground + trunkH + 0.9;
    const radius = range(rng, 2.6, 3.4);
    const coreR = radius * 0.42;
    dummy.position.set(t.x, cy, t.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(coreR);
    dummy.updateMatrix();
    cores.setMatrixAt(i, dummy.matrix);
    coreBase.push(dummy.matrix.clone());
    cores.setColorAt(i, tintK);
    const rec: TreeRecord = { center: new THREE.Vector3(t.x, cy, t.z), radius, records: [], hidden: false };
    for (let j = 0; j < canopyPlanes; j++) {
      const v = Math.floor(rng() * 4);
      const ang = j * 2.39996 + rng();
      const rr = radius * 0.5 * Math.sqrt((j + 0.5) / canopyPlanes);
      const px = t.x + Math.cos(ang) * rr;
      const pz = t.z + Math.sin(ang) * rr;
      const py = cy + range(rng, -0.5, 0.7) * (0.6 + rr * 0.2);
      const s = radius * range(rng, 1.25, 1.55);
      const tilt = -0.35 - rng() * 0.35;
      const idx = counts[v]++;
      const mesh = canopyMeshes[v];
      const base = place(mesh, idx, px, py, pz, ang + Math.PI / 2, s, tilt);
      mesh.setColorAt(idx, tintK);
      rec.records.push({ mesh, idx, base });
    }
    treeRecords.push(rec);
  });
  canopyMeshes.forEach((m, k) => {
    m.count = counts[k];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    stats.treeCanopies += counts[k];
    group.add(m);
  });
  cores.instanceMatrix.needsUpdate = true;
  cores.instanceColor!.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  trunks.instanceColor!.needsUpdate = true;
  group.add(trunks, cores);
  disposables.push(trunkGeo, barkMat, coreGeo, coreMat, canopyGeo, ...canopyMats, ...canopyMeshes, trunks, cores);

  // ----- samambaias e cogumelos em torno das árvores e no sub-bosque
  const undergrowth = (count: number, texName: string, variants: number, sizeMin: number, sizeMax: number, amp: number, nearTrees: boolean) => {
    const groups: Array<Array<{ x: number; z: number; s: number; r: number }>> = Array.from({ length: variants }, () => []);
    let tries = 0;
    while (groups.reduce((a, g) => a + g.length, 0) < count && tries++ < count * 40) {
      let x: number, z: number;
      if (nearTrees && trees.length) {
        const t = trees[Math.floor(rng() * trees.length)];
        x = t.x + range(rng, -1.6, 1.6);
        z = t.z + range(rng, -1.6, 1.6);
      } else {
        x = range(rng, BOUNDS.minX + 1, BOUNDS.maxX - 1);
        z = range(rng, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
      }
      if (!isFreeCell(grid, x, z, pathSet)) continue;
      const v = Math.floor(rng() * variants);
      groups[v].push({ x, z, s: range(rng, sizeMin, sizeMax), r: rng() * Math.PI * 2 });
    }
    groups.forEach((list, v) => {
      if (!list.length) return;
      const frame = texName === 'ferns' ? `fern_${v}` : `mushroom_${v}`;
      const tex = assets.frame(texName === 'ferns' ? 'ferns' : 'mushrooms', frame);
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.translate(0, 0.5, 0);
      const mat = withWind(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }), wind, amp);
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      m.receiveShadow = true;
      list.forEach((p, i) => place(m, i, p.x, heightAt(p.x, p.z), p.z, p.r, p.s));
      m.instanceMatrix.needsUpdate = true;
      group.add(m);
      disposables.push(geo, mat, m);
    });
  };
  undergrowth(Math.round(preset.flowerCount * 0.06), 'ferns', 2, 1.1, 2.0, 0.06, true);
  undergrowth(Math.round(preset.flowerCount * 0.05), 'mushrooms', 2, 0.5, 0.8, 0.0, true);

  // ----- rochas com musgo
  const rockGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const rp = rockGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const n = 1 + 0.25 * Math.sin(x * 9.1 + y * 4.3) * Math.cos(z * 7.7 - x * 2.1);
    rp.setXYZ(i, x * n, y * n * 0.7, z * n);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ map: assets.texture('rock_moss'), roughness: 0.95, flatShading: true });
  const rockCount = 16;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  let rockPlaced = 0;
  for (let tries = 0; rockPlaced < rockCount && tries < 2000; tries++) {
    const x = range(rng, BOUNDS.minX + 2, BOUNDS.maxX - 2);
    const z = range(rng, BOUNDS.minZ + 2, BOUNDS.maxZ - 2);
    if (!isFreeCell(grid, x, z, pathSet) || Math.hypot(x, z) < 8) continue;
    const s = range(rng, 0.35, 0.9);
    dummy.position.set(x, heightAt(x, z) + s * 0.2, z);
    dummy.rotation.set(rng(), rng() * 6.28, rng());
    dummy.scale.set(s * 1.2, s, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(rockPlaced++, dummy.matrix);
  }
  rocks.count = rockPlaced;
  rocks.instanceMatrix.needsUpdate = true;
  group.add(rocks);
  disposables.push(rockGeo, rockMat, rocks);

  // ----- raízes que saem do chão em direção ao caminho
  const rootMat = new THREE.MeshStandardMaterial({ map: assets.tiled('bark', 2, 1), roughness: 0.95 });
  for (let i = 0; i < Math.min(8, trees.length); i++) {
    const t = trees[i];
    const pts: THREE.Vector3[] = [];
    const ang = rng() * Math.PI * 2;
    for (let k = 0; k <= 4; k++) {
      const d = 0.2 + k * 0.45;
      const x = t.x + Math.cos(ang + k * 0.3) * d;
      const z = t.z + Math.sin(ang + k * 0.3) * d;
      pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.05 * (k === 0 ? 1 : 1 - k * 0.15), z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.08 + rng() * 0.04, 5), rootMat);
    root.castShadow = true;
    group.add(root);
    disposables.push(root.geometry);
  }
  disposables.push(rootMat);

  // ----- ocultação das copas: árvore entre câmera e jogador é escondida por escala zero
  const updateOcclusion = (camPos: THREE.Vector3, playerPos: THREE.Vector3): number => {
    const seg = new THREE.Vector3().subVectors(playerPos, camPos);
    const len2 = Math.max(seg.lengthSq(), 1e-6);
    let hiddenNow = 0;
    const tmp = new THREE.Vector3();
    treeRecords.forEach((rec, i) => {
      tmp.subVectors(rec.center, camPos);
      const t = tmp.dot(seg) / len2;
      let want = false;
      // Só esconde a copa quando ela está realmente entre a câmera e a cabeça do herói.
      if (t > 0.2 && t < 0.85 && rec.center.y > playerPos.y + 1.4) {
        const closest = camPos.clone().addScaledVector(seg, t);
        want = closest.distanceTo(rec.center) < rec.radius * 0.6;
      }
      if (want) hiddenNow++;
      if (rec.hidden !== want) {
        rec.hidden = want;
        for (const r of rec.records) {
          r.mesh.setMatrixAt(r.idx, want ? ZERO : r.base);
          r.mesh.instanceMatrix.needsUpdate = true;
        }
        cores.setMatrixAt(i, want ? ZERO : coreBase[i]);
        cores.instanceMatrix.needsUpdate = true;
      }
    });
    return hiddenNow;
  };

  return {
    group,
    stats,
    updateOcclusion,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Zona corrompida: cristais roxos com brilho, e partículas que sobem devagar. */
export function buildCorruption(assets: Assets, particleRate: number): { group: THREE.Group; update(t: number, dt: number): void } {
  const rng = mulberry32(777);
  const group = new THREE.Group();
  group.name = 'corruption';
  const crystalGeo = new THREE.ConeGeometry(0.28, 2.2, 5, 1);
  crystalGeo.translate(0, 1.1, 0);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#2b1240', emissive: '#9b3dff', emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2,
  });
  const crystals: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const r = CORRUPT_ZONE.r * (0.45 + rng() * 0.45);
    const x = CORRUPT_ZONE.x + Math.cos(a) * r;
    const z = CORRUPT_ZONE.z + Math.sin(a) * r;
    const m = new THREE.Mesh(crystalGeo, crystalMat);
    m.position.set(x, heightAt(x, z), z);
    m.rotation.set((rng() - 0.5) * 0.3, rng() * 6, (rng() - 0.5) * 0.3);
    m.scale.setScalar(0.9 + rng() * 0.7);
    m.castShadow = true;
    group.add(m);
    crystals.push(m);
  }
  const glowMat = new THREE.SpriteMaterial({
    map: assets.texture('glow_soft'), color: '#b44cff', transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Sprite(glowMat);
  halo.scale.set(CORRUPT_ZONE.r * 2.2, CORRUPT_ZONE.r * 2.2, 1);
  halo.position.set(CORRUPT_ZONE.x, 1.2, CORRUPT_ZONE.z);
  group.add(halo);

  const count = Math.round(200 * particleRate);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * CORRUPT_ZONE.r;
    pos[i * 3] = CORRUPT_ZONE.x + Math.cos(a) * r;
    pos[i * 3 + 1] = rng() * 3;
    pos[i * 3 + 2] = CORRUPT_ZONE.z + Math.sin(a) * r;
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motesMat = new THREE.PointsMaterial({
    color: '#d08cff', size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const motes = new THREE.Points(motesGeo, motesMat);
  group.add(motes);

  return {
    group,
    update(t, dt) {
      crystalMat.emissiveIntensity = 0.7 + 0.35 * Math.sin(t * 1.7);
      glowMat.opacity = 0.35 + 0.12 * Math.sin(t * 1.1);
      const p = motesGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let y = p.getY(i) + dt * 0.35;
        if (y > 3.2) y = 0.05;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.1);
      }
      p.needsUpdate = true;
    },
  };
}
