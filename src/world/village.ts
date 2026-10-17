// Vila do Primeiro Fio: casas, cercas, lanternas, poço, decoração e o portal luminoso.
import * as THREE from 'three';
import { Assets } from '../render/assets';
import { HOUSES, fenceCells, LANTERNS, WELL, PROPS, PORTAL, House } from './layout';
import { heightAt } from './terrain';
import { WindUniforms, withWind } from '../render/materials';

export interface Village {
  group: THREE.Group;
  portalLight: THREE.PointLight;
  lanternLights: THREE.PointLight[];
  update(t: number, dt: number, camera: THREE.Camera): void;
  /** Dispara o pulso de conclusão do portal (0..1 decai sozinho). */
  pulse(strength: number): void;
}

function buildHouse(h: House, assets: Assets, windowsEmissive: THREE.Material, shingle: THREE.Material, wallMat: (k: 'wood' | 'stone') => THREE.Material, doorMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = `casa-${h.id}`;
  const cx = h.x + (h.w - 1) / 2;
  const cz = h.z + (h.d - 1) / 2;
  const wallH = 2.1;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(h.w - 0.1, wallH, h.d - 0.1), wallMat(h.kind));
  walls.position.set(cx, heightAt(cx, cz) + wallH / 2, cz);
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);
  const radius = Math.max(h.w, h.d) * 0.78;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.4, 4), shingle);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(cx, heightAt(cx, cz) + wallH + 0.7, cz);
  roof.castShadow = true;
  g.add(roof);
  // Janelas nas duas faces longas e porta na face frontal (+z).
  const winGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const addWindow = (x: number, y: number, z: number, ry: number) => {
    const w = new THREE.Mesh(winGeo, windowsEmissive);
    w.position.set(x, y, z);
    w.rotation.y = ry;
    g.add(w);
  };
  addWindow(cx - h.w / 3 + 0.2, heightAt(cx, cz) + 1.2, cz + h.d / 2 + 0.01, 0);
  addWindow(cx + h.w / 3 - 0.2, heightAt(cx, cz) + 1.2, cz + h.d / 2 + 0.01, 0);
  addWindow(cx + h.w / 2 + 0.01, heightAt(cx, cz) + 1.2, cz, Math.PI / 2);
  addWindow(cx - h.w / 2 - 0.01, heightAt(cx, cz) + 1.2, cz, -Math.PI / 2);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), doorMat);
  door.position.set(cx, heightAt(cx, cz) + 0.45, cz + h.d / 2 + 0.012);
  g.add(door);
  void assets;
  return g;
}

export function buildVillage(assets: Assets, wind: WindUniforms): Village {
  const group = new THREE.Group();
  group.name = 'village';
  const woodMat = new THREE.MeshStandardMaterial({ map: assets.tiled('wood_wall', 1, 1), roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: assets.tiled('stone_wall', 1.5, 1), roughness: 0.95 });
  const shingleMat = new THREE.MeshStandardMaterial({ map: assets.tiled('shingle_roof', 2, 2), roughness: 0.8 });
  const windowMat = new THREE.MeshStandardMaterial({
    map: assets.texture('window_lit'), emissive: '#ffcf7a', emissiveMap: assets.texture('window_lit'),
    emissiveIntensity: 1.6, roughness: 0.6,
  });
  const doorMat = new THREE.MeshStandardMaterial({ map: assets.texture('door'), roughness: 0.8 });
  const wallMat = (k: 'wood' | 'stone') => (k === 'wood' ? woodMat : stoneMat);

  for (const h of HOUSES) group.add(buildHouse(h, assets, windowMat, shingleMat, wallMat, doorMat));

  // Cercas: um poste por célula e trilhos entre células vizinhas.
  const fence = fenceCells();
  const fenceKeys = new Set(fence.map((c) => `${c.x},${c.z}`));
  const postGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
  const railGeoX = new THREE.BoxGeometry(1, 0.08, 0.06);
  const railGeoZ = new THREE.BoxGeometry(0.06, 0.08, 1);
  const fenceMat = new THREE.MeshStandardMaterial({ map: assets.tiled('wood_wall', 1, 1), color: '#c9a77a', roughness: 0.9 });
  for (const c of fence) {
    const y = heightAt(c.x, c.z);
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(c.x, y + 0.45, c.z);
    post.castShadow = true;
    group.add(post);
    if (fenceKeys.has(`${c.x + 1},${c.z}`)) {
      for (const dy of [0.3, 0.65]) {
        const r = new THREE.Mesh(railGeoX, fenceMat);
        r.position.set(c.x + 0.5, y + dy, c.z);
        r.castShadow = true;
        group.add(r);
      }
    }
    if (fenceKeys.has(`${c.x},${c.z + 1}`)) {
      for (const dy of [0.3, 0.65]) {
        const r = new THREE.Mesh(railGeoZ, fenceMat);
        r.position.set(c.x, y + dy, c.z + 0.5);
        r.castShadow = true;
        group.add(r);
      }
    }
  }

  // Lanternas: poste, globo emissivo e luz pontual quente.
  const lanternLights: THREE.PointLight[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3026', roughness: 0.7 });
  const globeMat = new THREE.MeshStandardMaterial({ color: '#ffd58a', emissive: '#ffae4a', emissiveIntensity: 2.2 });
  for (const l of LANTERNS) {
    const y = heightAt(l.x, l.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 6), poleMat);
    pole.position.set(l.x, y + 0.95, l.z);
    pole.castShadow = true;
    group.add(pole);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), globeMat);
    globe.position.set(l.x, y + 2.0, l.z);
    group.add(globe);
    const light = new THREE.PointLight('#ffb866', 1.4, 6, 2);
    light.position.set(l.x, y + 2.0, l.z);
    group.add(light);
    lanternLights.push(light);
  }

  // Poço de pedra com teto.
  const wy = heightAt(WELL.x, WELL.z);
  const wellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.8, 12), new THREE.MeshStandardMaterial({ map: assets.tiled('moss_stone', 1, 1), roughness: 0.95 }));
  wellBody.position.set(WELL.x, wy + 0.4, WELL.z);
  wellBody.castShadow = true;
  group.add(wellBody);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshStandardMaterial({ color: '#1f4f6e', roughness: 0.1, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(WELL.x, wy + 0.78, WELL.z);
  group.add(water);
  for (const dx of [-0.5, 0.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), poleMat);
    post.position.set(WELL.x + dx, wy + 1.1, WELL.z);
    post.castShadow = true;
    group.add(post);
  }
  const roofW = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 4), shingleMat);
  roofW.rotation.y = Math.PI / 4;
  roofW.position.set(WELL.x, wy + 1.9, WELL.z);
  roofW.castShadow = true;
  group.add(roofW);

  // Decoração: barris, caixas, arbustos, placa e pedra.
  const barrelGeo = new THREE.CylinderGeometry(0.26, 0.28, 0.6, 10);
  const barrelMat = new THREE.MeshStandardMaterial({ map: assets.tiled('wood_wall', 1, 1), color: '#a0703f', roughness: 0.9 });
  const crateGeo = new THREE.BoxGeometry(0.55, 0.5, 0.55);
  const crateMat = new THREE.MeshStandardMaterial({ map: assets.tiled('wood_wall', 1, 1), color: '#c69a62', roughness: 0.9 });
  const bushMat = withWind(new THREE.MeshStandardMaterial({ map: assets.frame('leaf_clusters', 'cluster_2'), alphaTest: 0.4, side: THREE.DoubleSide }), wind, 0.04);
  const bushGeo = new THREE.PlaneGeometry(1.5, 1.5);
  bushGeo.translate(0, 0.7, 0);
  const signMat = new THREE.MeshStandardMaterial({ color: '#8a5c33', roughness: 0.9 });
  const rockGeo = new THREE.DodecahedronGeometry(0.35, 0);
  const rockMat = new THREE.MeshStandardMaterial({ map: assets.texture('rock_moss'), roughness: 0.95, flatShading: true });
  for (const p of PROPS) {
    const y = heightAt(p.x, p.z);
    if (p.kind === 'barrel') {
      const m = new THREE.Mesh(barrelGeo, barrelMat); m.position.set(p.x, y + 0.3, p.z); m.castShadow = true; group.add(m);
    } else if (p.kind === 'crate') {
      const m = new THREE.Mesh(crateGeo, crateMat); m.position.set(p.x, y + 0.25, p.z); m.rotation.y = p.x * 0.7; m.castShadow = true; group.add(m);
    } else if (p.kind === 'bush') {
      for (const r of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(bushGeo, bushMat);
        m.position.set(p.x, y, p.z);
        m.rotation.y = r + p.x;
        group.add(m);
      }
    } else if (p.kind === 'sign') {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), signMat);
      post.position.set(p.x, y + 0.55, p.z); group.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.06), signMat);
      board.position.set(p.x, y + 1.0, p.z); board.castShadow = true; group.add(board);
    } else if (p.kind === 'stone') {
      const m = new THREE.Mesh(rockGeo, rockMat); m.position.set(p.x, y + 0.15, p.z); m.scale.set(1.2, 0.8, 1.0); m.castShadow = true; group.add(m);
    }
  }

  // Portal: pedestal, anel vertical, disco de energia animado e luz própria.
  const portalY = heightAt(PORTAL.x, PORTAL.z);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 14), new THREE.MeshStandardMaterial({ map: assets.tiled('stone_plaza', 1, 1), roughness: 0.8 }));
  pedestal.position.set(PORTAL.x, portalY + 0.25, PORTAL.z);
  pedestal.castShadow = true;
  group.add(pedestal);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#8ff7ff', emissive: '#7ff0ff', emissiveIntensity: 0.7, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.11, 10, 48), ringMat);
  ring.position.set(PORTAL.x, portalY + 2.0, PORTAL.z);
  ring.castShadow = true;
  group.add(ring);
  const portalUniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const discMat = new THREE.ShaderMaterial({
    uniforms: portalUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uPulse; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float swirl = sin(a * 3.0 + r * 9.0 - uTime * 2.2) * 0.5 + 0.5;
        float ring = smoothstep(1.0, 0.55, r) * smoothstep(0.0, 0.25, r);
        vec3 col = mix(vec3(0.35, 0.95, 1.0), vec3(1.0, 0.85, 0.45), swirl);
        float alpha = ring * (0.35 + 0.35 * swirl) + uPulse * 0.8 * smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(col * (1.0 + uPulse * 3.0), alpha);
      }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), discMat);
  disc.position.set(PORTAL.x, portalY + 2.0, PORTAL.z + 0.01);
  group.add(disc);
  const portalLight = new THREE.PointLight('#7ff0ff', 2.2, 9, 2);
  portalLight.position.set(PORTAL.x, portalY + 2.0, PORTAL.z + 1);
  group.add(portalLight);

  // Partículas orbitando o portal.
  const orbitCount = 90;
  const orbitGeo = new THREE.BufferGeometry();
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(orbitCount * 3), 3));
  const orbitMat = new THREE.PointsMaterial({ color: '#c8fbff', size: 0.09, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const orbit = new THREE.Points(orbitGeo, orbitMat);
  group.add(orbit);
  const seeds = Array.from({ length: orbitCount }, (_, i) => ({ a: (i / orbitCount) * Math.PI * 2, r: 1.25 + ((i * 37) % 11) / 20, s: 0.4 + ((i * 17) % 7) / 10 }));

  // Halo do portal (sprite aditiva).
  const haloMat = new THREE.SpriteMaterial({ map: assets.texture('glow_soft'), color: '#7ff0ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(6.5, 6.5, 1);
  halo.position.set(PORTAL.x, portalY + 2.0, PORTAL.z);
  group.add(halo);

  let pulseLeft = 0;
  return {
    group,
    portalLight,
    lanternLights,
    pulse(strength) {
      pulseLeft = strength;
    },
    update(t, dt) {
      portalUniforms.uTime.value = t;
      pulseLeft = Math.max(0, pulseLeft - dt * 0.35);
      portalUniforms.uPulse.value = pulseLeft;
      portalLight.intensity = 2.2 + pulseLeft * 6;
      haloMat.opacity = 0.45 + 0.1 * Math.sin(t * 2.3) + pulseLeft * 0.4;
      ring.rotation.z = t * 0.15;
      const p = orbitGeo.attributes.position as THREE.BufferAttribute;
      seeds.forEach((s, i) => {
        const a = s.a + t * s.s;
        p.setXYZ(i, PORTAL.x + Math.cos(a) * s.r, portalY + 2.0 + Math.sin(a * 1.7 + i) * 0.9, PORTAL.z + Math.sin(a) * s.r * 0.25);
      });
      p.needsUpdate = true;
    },
  };
}
